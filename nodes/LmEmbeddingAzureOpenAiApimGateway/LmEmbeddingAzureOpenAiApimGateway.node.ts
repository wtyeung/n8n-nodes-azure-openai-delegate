import type { INodeType, INodeTypeDescription, ISupplyDataFunctions, SupplyData } from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { resolveGatewayAuth } from '../shared/gatewayAuth';

type EmbeddingOptions = {
	batchSize?: number;
	dimensions?: number;
	stripNewLines?: boolean;
	timeout?: number;
};

export class LmEmbeddingAzureOpenAiApimGateway implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Embeddings Azure OpenAI (APIM Gateway)',
		name: 'lmEmbeddingAzureOpenAiApimGateway',
		icon: { light: 'file:azureOpenAi.svg', dark: 'file:azureOpenAi.dark.svg' },
		subtitle: 'Embeddings',
		credentials: [{ name: 'apimGatewayEntraOAuth2Api', required: true }],
		group: ['transform'],
		version: [1],
		description: 'Use Azure OpenAI embeddings through an APIM gateway with delegated Entra authentication',
		defaults: {
			name: 'Embeddings Azure OpenAI (APIM Gateway)',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Embeddings'],
			},
			resources: {
				primaryDocumentation: [
					{ url: 'https://github.com/wtyeung/n8n-nodes-azure-openai-delegate' },
				],
			},
		},
		inputs: [],
		outputs: [NodeConnectionTypes.AiEmbedding],
		outputNames: ['Embeddings'],
		properties: [
			{
				displayName: 'Model (Deployment Name)',
				name: 'model',
				type: 'string',
				required: true,
				default: 'text-embedding-3-small',
				description: 'Embedding deployment name exposed by the APIM gateway',
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
						displayName: 'Batch Size',
						name: 'batchSize',
						default: 512,
						typeOptions: { maxValue: 2048, minValue: 1 },
						description: 'Maximum number of documents to send in each request',
						type: 'number',
					},
					{
						displayName: 'Dimensions',
						name: 'dimensions',
						default: 1536,
						typeOptions: { minValue: 1 },
						description: 'Number of dimensions in the output embeddings',
						type: 'number',
					},
					{
						displayName: 'Strip New Lines',
						name: 'stripNewLines',
						default: true,
						description: 'Whether to strip new lines from input text',
						type: 'boolean',
					},
					{
						displayName: 'Timeout (Ms)',
						name: 'timeout',
						default: 60000,
						typeOptions: { minValue: 1 },
						description: 'Maximum amount of time a request is allowed to take in milliseconds',
						type: 'number',
					},
				],
			},
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		try {
			const deploymentName = this.getNodeParameter('model', itemIndex) as string;
			const options = this.getNodeParameter('options', itemIndex, {}) as EmbeddingOptions;
			const timeout = options.timeout ?? 60000;
			const auth = await resolveGatewayAuth(this);

			const { AzureOpenAIEmbeddings } = await import('@langchain/openai');
			const { aiClientFetch, getProxyAgent, logWrapper } = await import('@n8n/ai-utilities');
			const embeddings = new AzureOpenAIEmbeddings({
				azureOpenAIApiDeploymentName: deploymentName,
				azureADTokenProvider: auth.getToken,
				azureOpenAIEndpoint: auth.endpoint,
				azureOpenAIApiVersion: auth.apiVersion,
				batchSize: options.batchSize,
				dimensions: options.dimensions,
				stripNewLines: options.stripNewLines,
				timeout,
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
			});

			return { response: logWrapper(embeddings as never, this) };
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			throw new NodeOperationError(
				this.getNode(),
				`Failed to initialize Azure OpenAI APIM embeddings: ${message}`,
				error,
			);
		}
	}
}
