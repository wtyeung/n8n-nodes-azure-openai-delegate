import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class ApimGatewayEntraOAuth2Api implements ICredentialType {
	name = 'apimGatewayEntraOAuth2Api';

	extends = ['microsoftOAuth2Api'];

	displayName = 'APIM Gateway Entra OAuth2 API';

	documentationUrl = 'https://github.com/wtyeung/n8n-nodes-azure-openai-delegate#credentials';

	icon = {
		light: 'file:../nodes/LmChatAzureOpenAiApimGateway/azureOpenAi.svg',
		dark: 'file:../nodes/LmChatAzureOpenAiApimGateway/azureOpenAi.dark.svg',
	} as const;

	properties: INodeProperties[] = [
		{
			displayName: 'Tenant ID',
			name: 'tenantId',
			type: 'string',
			required: true,
			default: 'common',
			placeholder: '00000000-0000-0000-0000-000000000000',
			description: 'Microsoft Entra tenant ID (or "organizations" / "common")',
			noDataExpression: true,
		},
		{
			displayName: 'API Scope',
			name: 'apiScope',
			type: 'string',
			required: true,
			default: '',
			placeholder: 'api://<gateway-app-id>/<delegated-scope>',
			description:
				'Delegated scope exposed by the gateway app registration. "offline_access" is added automatically for token refresh.',
			noDataExpression: true,
		},
		{
			displayName: 'Scope',
			name: 'scope',
			type: 'hidden',
			default:
				'={{$self.apiScope.includes("offline_access") ? $self.apiScope : "offline_access " + $self.apiScope}}',
		},
		{
			displayName: 'Grant Type',
			name: 'grantType',
			type: 'hidden',
			default: 'authorizationCode',
		},
		{
			displayName: 'Authorization URL',
			name: 'authUrl',
			type: 'hidden',
			default: '=https://login.microsoftonline.com/{{$self.tenantId}}/oauth2/v2.0/authorize',
			required: true,
		},
		{
			displayName: 'Access Token URL',
			name: 'accessTokenUrl',
			type: 'hidden',
			default: '=https://login.microsoftonline.com/{{$self.tenantId}}/oauth2/v2.0/token',
			required: true,
		},
		{
			displayName: 'Authentication',
			name: 'authentication',
			type: 'hidden',
			default: 'body',
		},
		{
			displayName: 'Gateway Endpoint',
			name: 'endpoint',
			type: 'string',
			required: true,
			default: '',
			placeholder: 'https://<gateway-host>/<api-path>/',
			description: 'HTTPS base URL of the APIM LLM gateway (with trailing slash)',
			noDataExpression: true,
		},
		{
			displayName: 'API Version',
			name: 'apiVersion',
			type: 'string',
			required: true,
			default: '2025-03-01-preview',
			description: 'Azure OpenAI API version sent to the gateway',
			noDataExpression: true,
		},
		{
			displayName: 'Probe Path',
			name: 'probePath',
			type: 'string',
			required: true,
			default: 'openai/deployments',
			description:
				'Lightweight GET path on the gateway, relative to the endpoint. It must require the delegated token and return 2xx. Used to trigger and persist token refresh.',
			noDataExpression: true,
		},
		{
			displayName: 'Token Refresh Buffer (Seconds)',
			name: 'refreshBeforeExpirySeconds',
			type: 'number',
			typeOptions: { minValue: 60, maxValue: 3600 },
			default: 60,
			description: 'Refresh the token this many seconds before it expires',
			noDataExpression: true,
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.oauthTokenData.access_token}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.endpoint}}',
			url: '=openai/deployments?api-version={{$credentials.apiVersion}}',
			method: 'GET',
		},
	};
}
