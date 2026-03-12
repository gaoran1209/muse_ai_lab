export type GenerationMode = 'image' | 'video';

export interface ExposedParam {
  name: string;
  type: string;
  default: unknown;
  description: string;
  choices: string[] | null;
  required: boolean;
}

export interface ProviderInfo {
  vendor: string;
  model: string;
  available: boolean;
  info: {
    provider_type: string;
    exposed_params: ExposedParam[];
  };
}

const MODEL_LABELS: Record<string, string> = {
  'gemini-3.1-flash-image-preview': 'Nano Banana 2',
  'gemini-3-pro-image-preview': 'Nano Banana Pro',
  'imagen-4.0-fast-generate-001': 'Imagen 4.0 Fast',
  'imagen-4.0-generate-001': 'Imagen 4.0',
  'imagen-4.0-ultra-generate-001': 'Imagen 4.0 Ultra',
  'kling-v1-6': 'Kling1.6',
  'kling-v1-6-hq': 'Kling1.6 HQ',
  'kling-v2-0': 'Kling2.0',
  'kling-v2-1': 'Kling2.1',
  'kling-v2-1-master': 'Kling2.1 Master',
  'kling-v2-5-turbo': 'Kling2.5 Turbo',
  'google/nano-banana-2': 'Nano Banana 2',
  'google/nano-banana-pro': 'Nano Banana Pro',
};

const PROVIDER_LABELS: Record<string, string> = {
  gemini: 'Google',
  '302ai_gemini': '302.AI',
  '302ai_kling': 'Kling',
};

const VISIBLE_VENDORS: Record<GenerationMode, string[]> = {
  image: ['gemini', '302ai_gemini'],
  video: ['302ai_kling'],
};

const ALLOWED_MODEL_CHOICES: Record<string, string[]> = {
  gemini: ['gemini-3.1-flash-image-preview', 'gemini-3-pro-image-preview'],
  '302ai_gemini': ['gemini-3.1-flash-image-preview', 'gemini-3-pro-image-preview'],
  '302ai_kling': ['kling-v2-0'],
};

export function getProviderLabel(vendor: string): string {
  return PROVIDER_LABELS[vendor] ?? vendor;
}

export function getModelLabel(model: string): string {
  return MODEL_LABELS[model] ?? model;
}

export function isImageParam(param: ExposedParam): boolean {
  const name = param.name.toLowerCase();
  return name === 'image' || name === 'images';
}

export function getModelParam(provider: ProviderInfo | undefined): ExposedParam | undefined {
  return provider?.info.exposed_params.find((param) => param.name === 'model_name');
}

export function getVisibleProviders(mode: GenerationMode, providers: ProviderInfo[]): ProviderInfo[] {
  const visibleVendors = new Set(VISIBLE_VENDORS[mode]);
  return providers.filter((provider) => visibleVendors.has(provider.vendor));
}

export function getModelChoices(provider: ProviderInfo | undefined): string[] {
  if (!provider) return [];

  const allowedChoices = ALLOWED_MODEL_CHOICES[provider.vendor];
  const modelParam = getModelParam(provider);
  const sourceChoices = modelParam?.choices?.length ? modelParam.choices : [provider.model].filter(Boolean);

  if (!allowedChoices?.length) {
    return sourceChoices.filter(Boolean);
  }

  const sourceSet = new Set(sourceChoices.filter(Boolean));
  const filteredChoices = allowedChoices.filter((choice) => sourceSet.has(choice) || choice === provider.model);

  return filteredChoices.length > 0 ? filteredChoices : allowedChoices;
}

export function buildDefaults(provider: ProviderInfo): Record<string, unknown> {
  const defaults = Object.fromEntries(
    provider.info.exposed_params
      .filter((param) => !isImageParam(param))
      .map((param) => [param.name, param.default ?? ''])
  );

  const modelChoices = getModelChoices(provider);
  if (modelChoices.length > 0) {
    defaults.model_name = modelChoices[0];
  }

  return defaults;
}
