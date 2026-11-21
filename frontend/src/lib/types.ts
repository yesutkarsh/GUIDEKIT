export interface Developer {
  id: string
  email: string
  display_name: string | null
  auth_provider: string
  created_at: string
}

export interface Organization {
  id: string
  name: string
  slug: string
  created_at: string
}

export interface Project {
  id: string
  org_id: string
  name: string
  slug: string
  framework: string
  default_locale: string
  supported_locales: string[]
  auth_detection_config: Record<string, unknown>
  chat_settings: Record<string, unknown>
  environment: ProjectEnvironment
  background_id: ProjectBackgroundId
  created_at: string
  updated_at: string
  archived_at: string | null
}

export type ProjectEnvironment = 'development' | 'staging' | 'production'

export type ProjectBackgroundId =
  | 'untitled-blend'
  | 'citron'
  | 'morning-haze'
  | 'blue-sky'
  | 'sunset-pop'

export interface ProjectOrigin {
  id: string
  project_id: string
  origin: string
  environment: string
  created_at: string
}

export interface ApiKey {
  id: string
  project_id: string
  key_type: string
  key_prefix: string
  key_plain: string | null
  label: string | null
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

export interface WorkflowStep {
  id: string
  project_id: string
  feature_version_id: string
  step_order: number
  guide_id: string | null
  route_pattern: string
  action_type: string
  advance_on: string
  is_optional: boolean
  wait_timeout_ms: number
  condition: Record<string, unknown> | null
  content: Record<string, unknown>
  target_fingerprint: Record<string, unknown>
}

export interface FeatureVersion {
  id: string
  feature_id: string
  project_id: string
  version_number: number
  status: string
  content: Record<string, unknown>
  example_queries: string[]
  requires_auth: boolean
  required_role: string | null
  prerequisite_feature_id: string | null
  created_at: string
  updated_at: string
  published_at: string | null
}

export interface FeatureSummary {
  id: string
  project_id: string
  slug: string
  created_at: string
  archived_at: string | null
  draft_version: FeatureVersion | null
  published_version: FeatureVersion | null
  step_count: number
}

export interface FeatureDetail {
  id: string
  project_id: string
  slug: string
  created_at: string
  archived_at: string | null
  versions: FeatureVersion[]
  steps: WorkflowStep[]
}

export interface HealSuggestion {
  id: string
  project_id: string
  step_id: string
  suggested_fingerprint: Record<string, unknown>
  suggested_selector: string | null
  confidence: number | null
  occurrences: number
  status: string
  first_seen_at: string
  last_seen_at: string
  reviewed_by: string | null
  reviewed_at: string | null
  guide_id: string | null
  route_pattern: string | null
  feature_slug: string | null
}

export interface Analytics {
  chat: {
    total_sessions: number
    total_messages: number
    by_route: Record<string, number>
  }
  tours: {
    started: number
    step_completed: number
    completed: number
    exited: number
    failed: number
  }
  resolution: {
    matched_primary: number
    matched_fingerprint: number
    healed_by_ai: number
    fallback_to_text: number
    cache_hit: number
  }
  usage_daily: Array<{
    day: string
    chat_messages: number
    ai_resolutions: number
  }>
  latest_manifest: {
    manifest_version: number
    feature_count: number | null
    published_at: string
    etag: string
  } | null
}

export interface MeResponse {
  developer: Developer
  organizations: Organization[]
  onboarding_required: boolean
}

export interface DeviceAuthRequest {
  user_code: string
  client: 'vscode_extension' | 'cli'
  status: 'pending' | 'approved' | 'denied' | 'expired' | 'consumed'
  created_at: string
  expires_at: string
}

export interface ManifestPublishResult {
  id: string
  manifest_version: number
  etag: string
  byte_size: number
  feature_count: number
  storage_key: string
  published_at: string
}

export interface WorkflowSyncResult {
  synced_features: number
  draft_versions: Array<{
    feature_id: string
    slug: string
    version_id: string
    version_number: number
    step_count: number
  }>
}

export interface StitchedWorkflowStep {
  execution_index: number
  step_id: string
  feature_slug: string
  step_order: number
  guide_id: string | null
  route_pattern: string
  action_type: string
  advance_on: string
  is_optional: boolean
  wait_timeout_ms: number
  condition: Record<string, unknown> | null
  content: Record<string, { title?: string; description?: string }>
  target_fingerprint: Record<string, unknown>
}

export interface ChainedFeatureSummary {
  feature_id: string
  slug: string
  title: string
  version_number: number
  is_prerequisite: boolean
}

export interface TourPlan {
  target_feature_slug: string
  requires_login_first: boolean
  role_warning: string | null
  chained_features: ChainedFeatureSummary[]
  steps: StitchedWorkflowStep[]
}

export interface RetrievedChunkInfo {
  chunk_id: string
  source_title: string
  content_preview: string
  score: number
}

export interface SDKChatResponse {
  session_id: string
  message_id: string
  reply: string
  route_taken: 'feature_match' | 'rag_answer' | 'out_of_scope' | 'smalltalk'
  similarity: number | null
  matched_feature_slug: string | null
  tour_plan: TourPlan | null
  retrieved_chunks: RetrievedChunkInfo[]
}

export interface SDKHealResponse {
  status: 'cache_hit' | 'healed_by_ai' | 'fallback_to_text'
  step_id: string
  resolved_candidate: Record<string, unknown> | null
  suggested_selector: string | null
  confidence: number
  fallback_text: string | null
}

export interface KnowledgeSourceItem {
  id: string
  source_type: string
  title: string
  uri: string | null
  locale: string
  chunk_count: number
  created_at: string
}


