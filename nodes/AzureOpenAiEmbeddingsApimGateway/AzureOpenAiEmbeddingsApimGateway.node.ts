import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { APIM_GATEWAY_CREDENTIAL, resolveGatewayAuth } from '../shared/gatewayAuth';

type EmbeddingOptions = {
	dimensions?: number;
	encodingFormat?: 'float' | 'base64';
};

type EmbeddingsResponse = {
	data?: IDataObject[];
};

export class AzureOpenAiEmbeddingsApimGateway implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Azure OpenAI Embeddings (APIM Gateway)',
		name: 'azureOpenAiEmbeddingsApimGateway',
		icon: { light: 'file:azureOpenAi.svg', dark: 'file:azureOpenAi.dark.svg' },
		subtitle: 'Generate Embeddings',
		group: ['transform'],
		version: [1],
		description: 'Generate embeddings through an APIM gateway with delegated Entra authentication',
		defaults: {
			name: 'Azure OpenAI Embeddings (APIM Gateway)',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'apimGatewayEntraOAuth2Api', required: true }],
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
				displayName: 'Text',
				name: 'text',
				type: 'string',
				default: '',
				required: true,
				description: 'Text to generate embeddings for',
				typeOptions: { rows: 4 },
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Dimensions',
						name: 'dimensions',
						type: 'number',
						default: 1536,
						typeOptions: { minValue: 1 },
						description: 'Number of dimensions in the output embeddings',
					},
					{
						displayName: 'Encoding Format',
						name: 'encodingFormat',
						type: 'options',
						options: [
							{ name: 'Base64', value: 'base64' },
							{ name: 'Float', value: 'float' },
						],
						default: 'float',
						description: 'Format in which to return the embeddings',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const auth = await resolveGatewayAuth(this);

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const deploymentName = this.getNodeParameter('model', itemIndex) as string;
				const text = this.getNodeParameter('text', itemIndex) as string;
				const options = this.getNodeParameter('options', itemIndex, {}) as EmbeddingOptions;
				this.logger.debug('Generating Azure OpenAI APIM embedding', {
					deploymentName,
					itemIndex,
					dimensions: options.dimensions,
					encodingFormat: options.encodingFormat,
				});
				const token = await auth.getToken();
				const url = `${auth.endpoint}/openai/deployments/${encodeURIComponent(deploymentName)}/embeddings?api-version=${encodeURIComponent(auth.apiVersion)}`;
				const body: IDataObject = { input: text };
				if (options.dimensions) body.dimensions = options.dimensions;
				if (options.encodingFormat) body.encoding_format = options.encodingFormat;

				const response = (await this.helpers.httpRequestWithAuthentication.call(
					this,
					APIM_GATEWAY_CREDENTIAL,
					{
						method: 'POST',
						url,
						headers: { Authorization: `Bearer ${token}` },
						body,
						json: true,
						disableFollowRedirect: true,
					},
				)) as EmbeddingsResponse;

				for (const embedding of response.data ?? []) {
					returnData.push({ json: embedding, pairedItem: { item: itemIndex } });
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : 'Unknown error';
				if (this.continueOnFail()) {
					returnData.push({ json: { error: message }, pairedItem: { item: itemIndex } });
					continue;
				}
				throw new NodeOperationError(this.getNode(), `Failed to generate embedding: ${message}`, {
					itemIndex,
					description: message,
				});
			}
		}

		return [returnData];
	}
}
