import type { INodeType, INodeTypeDescription, ISupplyDataFunctions, SupplyData } from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { searchModels } from './searchModels';
import { resolveGatewayAuth } from './token';

type ModelOptions = {
	frequencyPenalty?: number;
	maxRetries?: number;
	maxTokens?: number;
	presencePenalty?: number;
	responseFormat?: 'text' | 'json_object';
	temperature?: number;
	timeout?: number;
	topP?: number;
	useResponsesApi?: boolean;
};

export class LmChatAzureOpenAiApimGateway implements INodeType {
	methods = {
		listSearch: {
			searchModels,
		},
	};

	description: INodeTypeDescription = {
		displayName: 'Azure OpenAI Chat Model (APIM Gateway)',
		name: 'lmChatAzureOpenAiApimGateway',
		icon: { light: 'file:azureOpenAi.svg', dark: 'file:azureOpenAi.dark.svg' },
		subtitle: '={{$parameter["model"]}}',
		group: ['transform'],
		version: [1],
		description: 'Azure OpenAI chat model through an APIM LLM gateway with delegated Entra authentication',
		defaults: {
			name: 'Azure OpenAI Chat Model (APIM Gateway)',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Language Models', 'Root Nodes'],
				'Language Models': ['Chat Models (Recommended)'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.lmchatazureopenai/',
					},
				],
			},
		},

		inputs: [],

		outputs: [NodeConnectionTypes.AiLanguageModel],
		outputNames: ['Model'],
		credentials: [{ name: 'apimGatewayEntraOAuth2Api', required: true }],
		properties: [
			{
				displayName:
					'If using JSON response format, you must include word "json" in the prompt. Also, make sure to select latest models released post November 2023.',
				name: 'notice',
				type: 'notice',
				default: '',
				displayOptions: { show: { '/options.responseFormat': ['json_object'] } },
			},
			{
				displayName: 'Model (Deployment Name)',
				name: 'model',
				type: 'resourceLocator',
				required: true,
				default: { mode: 'list', value: '' },
				description: 'The deployment name exposed by the gateway',
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'searchModels',
							searchable: true,
						},
					},
					{
						displayName: 'By Name',
						name: 'name',
						type: 'string',
						placeholder: 'deployment-name',
					},
				],
			},
			{
				displayName: 'Options',
				name: 'options',
				placeholder: 'Add Option',
				description: 'Additional options to add',
				type: 'collection',
				default: {},
				options: [
					{
						displayName: 'Frequency Penalty',
						name: 'frequencyPenalty',
						default: 0,
						typeOptions: { maxValue: 2, minValue: -2, numberPrecision: 1 },
						description:
							"Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim",
						type: 'number',
					},
					{
						displayName: 'Max Retries',
						name: 'maxRetries',
						default: 2,
						description: 'Maximum number of retries to attempt on failure',
						type: 'number',
					},
					{
						displayName: 'Maximum Number of Tokens',
						name: 'maxTokens',
						default: -1,
						description:
							'The maximum number of tokens to generate in the completion. Use -1 for default.',
						type: 'number',
						typeOptions: { maxValue: 128000 },
					},
					{
						displayName: 'Presence Penalty',
						name: 'presencePenalty',
						default: 0,
						typeOptions: { maxValue: 2, minValue: -2, numberPrecision: 1 },
						description:
							"Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics",
						type: 'number',
					},
					{
						displayName: 'Response Format',
						name: 'responseFormat',
						default: 'text',
						type: 'options',
						options: [
							{ name: 'Text', value: 'text', description: 'Regular text response' },
							{
								name: 'JSON',
								value: 'json_object',
								description:
									'Enables JSON mode, which should guarantee the message the model generates is valid JSON',
							},
						],
					},
					{
						displayName: 'Sampling Temperature',
						name: 'temperature',
						default: 0.7,
						typeOptions: { maxValue: 2, minValue: 0, numberPrecision: 1 },
						description:
							'Controls randomness: Lowering results in less random completions. As the temperature approaches zero, the model will become deterministic and repetitive.',
						type: 'number',
					},
					{
						displayName: 'Timeout (Ms)',
						name: 'timeout',
						default: 60000,
						description: 'Maximum amount of time a request is allowed to take in milliseconds',
						type: 'number',
					},
					{
						displayName: 'Top P',
						name: 'topP',
						default: 1,
						typeOptions: { maxValue: 1, minValue: 0, numberPrecision: 1 },
						description:
							'Controls diversity via nucleus sampling: 0.5 means half of all likelihood-weighted options are considered. We generally recommend altering this or temperature but not both.',
						type: 'number',
					},
					{
						displayName: 'Use Responses API',
						name: 'useResponsesApi',
						default: false,
						description:
							'Whether to call the Responses API instead of Chat Completions. Only enable if the gateway exposes that route.',
						type: 'boolean',
					},
				],
			},
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		try {
			const deploymentName = this.getNodeParameter('model', itemIndex, '', {
				extractValue: true,
			}) as string;
			const options = this.getNodeParameter('options', itemIndex, {}) as ModelOptions;
			const timeout = options.timeout ?? 60000;

			const auth = await resolveGatewayAuth(this);

			// Dynamic imports keep the node loadable when @langchain packages are not resolvable at load time
			const { AzureChatOpenAI } = await import('@langchain/openai');
			const {
				aiClientFetch,
				getProxyAgent,
				makeN8nLlmFailedAttemptHandler,
				N8nLlmTracing,
			} = await import('@n8n/ai-utilities');

			const model = new AzureChatOpenAI({
				model: deploymentName,
				azureOpenAIApiDeploymentName: deploymentName,
				azureADTokenProvider: auth.getToken,
				azureOpenAIEndpoint: auth.endpoint,
				azureOpenAIApiVersion: auth.apiVersion,
				maxTokens: options.maxTokens && options.maxTokens > 0 ? options.maxTokens : undefined,
				temperature: options.temperature,
				topP: options.topP,
				frequencyPenalty: options.frequencyPenalty,
				presencePenalty: options.presencePenalty,
				timeout,
				maxRetries: options.maxRetries ?? 2,
				modelKwargs: options.responseFormat
					? { response_format: { type: options.responseFormat } }
					: undefined,
				streaming: false,
				// Pin Chat Completions; newer @langchain/openai would otherwise auto-switch some models to /responses
				useResponsesApi: options.useResponsesApi ?? false,
				callbacks: [new N8nLlmTracing(this)],
				configuration: {
					fetch: aiClientFetch,
					fetchOptions: {
						dispatcher: getProxyAgent(
							auth.endpoint,
							{ headersTimeout: timeout, bodyTimeout: timeout },
							this.helpers.getSecureEgressFilter(),
						) as never,
					},
				},
				onFailedAttempt: makeN8nLlmFailedAttemptHandler(this),
			});

			return { response: model };
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			throw new NodeOperationError(
				this.getNode(),
				`Failed to initialize Azure OpenAI APIM client: ${message}`,
				error,
			);
		}
	}
}
