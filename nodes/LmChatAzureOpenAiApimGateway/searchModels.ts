import type { ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';

export async function searchModels(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const configuredModels = process.env.AZURE_OPENAI_MODELS ?? '';
	const normalizedFilter = filter?.trim().toLowerCase();
	const models = configuredModels
		.split(',')
		.map((model) => model.trim())
		.filter((model) => model.length > 0)
		.filter((model) => {
			const modelName = model.replace(/^\*/, '');
			return !normalizedFilter || modelName.toLowerCase().includes(normalizedFilter);
		})
		.sort((a, b) => {
			const aIsDefault = a.startsWith('*');
			const bIsDefault = b.startsWith('*');
			if (aIsDefault !== bIsDefault) return aIsDefault ? -1 : 1;
			return a.localeCompare(b);
		});

	return {
		results: models.map((model) => {
			const isDefault = model.startsWith('*');
			const modelName = model.replace(/^\*/, '');
			return {
				name: isDefault ? `${modelName} (default)` : modelName,
				value: modelName,
			};
		}),
	};
}
