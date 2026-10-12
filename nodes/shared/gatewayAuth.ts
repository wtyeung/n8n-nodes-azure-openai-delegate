import type { IExecuteFunctions, ISupplyDataFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

export const APIM_GATEWAY_CREDENTIAL = 'apimGatewayEntraOAuth2Api';

type GatewayContext = ISupplyDataFunctions | IExecuteFunctions;

interface OAuthTokenData {
	access_token?: string;
	expires_at?: number;
	exp?: number;
}

export interface GatewayAuth {
	endpoint: string;
	apiVersion: string;
	getToken: () => Promise<string>;
}

function jwtExpiry(token: string): number | undefined {
	try {
		const payload = token.split('.')[1];
		const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
		return (JSON.parse(json) as { exp?: number }).exp;
	} catch {
		return undefined;
	}
}

function requireHttps(ctx: GatewayContext, endpoint: string): string {
	let url: URL;
	try {
		url = new URL(endpoint);
	} catch {
		throw new NodeOperationError(ctx.getNode(), 'Gateway endpoint is not a valid URL');
	}
	if (url.protocol !== 'https:') {
		throw new NodeOperationError(ctx.getNode(), 'Gateway endpoint must use HTTPS');
	}
	return url.toString().replace(/\/+$/, '');
}

async function readToken(ctx: GatewayContext): Promise<{ token: string; expiresAt?: number }> {
	const data = (await ctx.getCredentials(APIM_GATEWAY_CREDENTIAL)).oauthTokenData as
		| OAuthTokenData
		| undefined;
	if (!data?.access_token) {
		throw new NodeOperationError(ctx.getNode(), 'No OAuth2 access token found. Reconnect the credential.');
	}
	return {
		token: data.access_token,
		expiresAt: jwtExpiry(data.access_token) ?? data.expires_at ?? data.exp,
	};
}

export async function resolveGatewayAuth(ctx: GatewayContext): Promise<GatewayAuth> {
	const credentials = await ctx.getCredentials(APIM_GATEWAY_CREDENTIAL);
	const endpoint = requireHttps(ctx, credentials.endpoint as string);
	const apiVersion = credentials.apiVersion as string;
	const probeUrl = `${endpoint}/${String(credentials.probePath).replace(/^\/+/, '')}?api-version=${apiVersion}`;
	const buffer = Math.min(3600, Math.max(60, (credentials.refreshBeforeExpirySeconds as number) ?? 60));

	const getToken = async () => {
		let { token, expiresAt } = await readToken(ctx);
		const now = Math.floor(Date.now() / 1000);
		if (expiresAt && now >= expiresAt - buffer) {
			ctx.logger.info('Delegated access token is near expiry; requesting refresh', {
				expiresInSeconds: expiresAt - now,
				refreshBufferSeconds: buffer,
			});
			try {
				await ctx.helpers.httpRequestWithAuthentication.call(ctx, APIM_GATEWAY_CREDENTIAL, {
					url: probeUrl,
					method: 'GET',
					json: true,
					disableFollowRedirect: true,
				});
			} catch (error) {
				if (now >= expiresAt) {
					throw new NodeOperationError(
						ctx.getNode(),
						'Access token expired and refresh failed. Reconnect the credential.',
						{ description: (error as Error).message },
					);
				}
			}
			({ token, expiresAt } = await readToken(ctx));
			ctx.logger.info('Delegated access token refresh probe completed', {
				expiresInSeconds: expiresAt ? expiresAt - now : undefined,
			});
			if (expiresAt && now >= expiresAt) {
				throw new NodeOperationError(
					ctx.getNode(),
					'Access token expired and was not refreshed. Reconnect the credential.',
				);
			}
		}
		return token;
	};

	return { endpoint, apiVersion, getToken };
}
