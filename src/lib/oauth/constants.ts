export const OAUTH_SCOPE = "garra"

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60
export const AUTH_CODE_TTL_SECONDS = 10 * 60
export const PENDING_CONSENT_TTL_SECONDS = 10 * 60

export const ACCESS_TOKEN_PREFIX = "gat_"
export const REFRESH_TOKEN_PREFIX = "grt_"
export const AUTH_CODE_PREFIX = "gac_"
export const CLIENT_ID_PREFIX = "gcl_"

export const TOKEN_ENDPOINT_AUTH_METHODS = ["none", "client_secret_basic", "client_secret_post"] as const
export type TokenEndpointAuthMethod = (typeof TOKEN_ENDPOINT_AUTH_METHODS)[number]
