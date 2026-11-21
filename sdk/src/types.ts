/**
 * GuideKit Universal Web SDK Types
 */

export interface GuideKitConfig {
  apiKey: string;
  apiUrl?: string;
  locale?: string;
  debug?: boolean;
  widget?: GuideKitWidgetOptions;
}

export type GuideKitWidgetPosition = "bottom-center" | "bottom-left" | "bottom-right";

export interface GuideKitWidgetTheme {
  accent?: string;
  accentHover?: string;
  accentText?: string;
  canvas?: string;
  surface?: string;
  surfaceHover?: string;
  border?: string;
  text?: string;
  mutedText?: string;
  fontFamily?: string;
}

export interface GuideKitWidgetOptions {
  position?: GuideKitWidgetPosition;
  bottomOffset?: number;
  sideOffset?: number;
  panelWidth?: number;
  panelHeight?: number;
  borderRadius?: number;
  launcherLabel?: string;
  assistantName?: string;
  greeting?: string;
  placeholder?: string;
  maxSuggestions?: number;
  showLocaleControl?: boolean;
  showVoiceControl?: boolean;
  soundEnabled?: boolean;
  theme?: GuideKitWidgetTheme;
}

export interface AuthDetectionRule {
  type: "cookie" | "localStorage" | "dom";
  name?: string;
  key?: string;
  selector?: string;
}

export interface AuthDetectionConfig {
  signed_in?: AuthDetectionRule;
  alt?: AuthDetectionRule[];
  role_source?: {
    type: "cookie" | "localStorage" | "dom";
    key?: string;
    selector?: string;
    attribute?: string;
  };
}

export interface TargetFingerprint {
  tag?: string;
  role?: string;
  text?: string;
  accessible_name?: string;
  css?: string;
  primary_selector?: string;
  guide_id?: string;
  landmark?: string;
  attrs?: Record<string, string>;
}

export interface WorkflowStepManifest {
  step_order: number;
  guide_id?: string;
  route_pattern: string;
  action_type: "click" | "input" | "select" | "navigate" | "hover" | "info";
  advance_on: "click" | "input_valid" | "route_change" | "element_appears" | "manual_next";
  is_optional?: boolean;
  wait_timeout_ms?: number;
  content: {
    en: {
      title: string;
      description: string;
      audio_url?: string;
    };
    hi?: {
      title: string;
      description: string;
      audio_url?: string;
    };
    [locale: string]: any;
  };
  target_fingerprint: TargetFingerprint;
}

export interface FeatureManifest {
  slug: string;
  content: {
    en: {
      title: string;
      description?: string;
      intent_description?: string;
    };
    hi?: {
      title: string;
      description?: string;
      intent_description?: string;
    };
    [locale: string]: any;
  };
  example_queries: string[];
  requires_auth?: boolean;
  required_role?: string | null;
  prerequisite_feature_slug?: string | null;
  steps: WorkflowStepManifest[];
}

export interface ManifestOut {
  project_id: string;
  project_slug: string;
  manifest_version: number;
  framework: string;
  default_locale: string;
  supported_locales: string[];
  auth_detection_config?: AuthDetectionConfig;
  features: FeatureManifest[];
  etag?: string;
}

export interface StitchedWorkflowStep {
  execution_index: number;
  step_id: string;
  feature_slug: string;
  step_order: number;
  guide_id?: string;
  route_pattern: string;
  action_type: string;
  advance_on: string;
  is_optional: boolean;
  wait_timeout_ms: number;
  condition?: Record<string, string> | null;
  content: Record<string, any>;
  target_fingerprint: TargetFingerprint;
}

export interface ChainedFeatureSummary {
  feature_id: string;
  slug: string;
  title: string;
  version_number: number;
  is_prerequisite: boolean;
}

export interface TourPlan {
  target_feature_slug: string;
  requires_login_first: boolean;
  role_warning?: string | null;
  chained_features: ChainedFeatureSummary[];
  steps: StitchedWorkflowStep[];
}

export interface RetrievedChunkInfo {
  chunk_id: string;
  source_title: string;
  content_preview: string;
  score: float;
}

export type float = number;

export interface SDKChatResponse {
  session_id: string;
  message_id: string;
  reply: string;
  route_taken: "feature_match" | "rag_answer" | "out_of_scope" | "smalltalk";
  similarity?: number | null;
  matched_feature_slug?: string | null;
  tour_plan?: TourPlan | null;
  suggested_tour_plan?: TourPlan | null;
  retrieved_chunks?: RetrievedChunkInfo[];
}

export interface CandidateElement {
  candidate_id: string;
  tag: string;
  role?: string;
  text?: string;
  accessible_name?: string;
  css_selector: string;
  attrs: Record<string, any>;
  landmark?: string;
}

export interface SDKHealResponse {
  status: "cache_hit" | "healed_by_ai" | "fallback_to_text";
  step_id: string;
  resolved_candidate?: CandidateElement | null;
  suggested_selector?: string | null;
  confidence: number;
  fallback_text?: string | null;
}

export type ResolutionStatus =
  | "matched_primary"
  | "matched_fingerprint"
  | "healed_by_ai"
  | "cache_hit"
  | "fallback_to_text";

export interface ActiveTourState {
  sessionId?: string;
  visitorId: string;
  locale: string;
  tourPlan: TourPlan;
  currentStepIndex: number;
  status: "running" | "paused" | "completed" | "aborted";
}

