import { ScannedRoute } from './routeScanner'
import { extractElements, InteractiveElement } from './elementExtractor'

export interface TargetFingerprint {
  guide_id?: string
  css: string
  role: string
  accessible_name: string[]
  text: string[]
  attrs: Record<string, string>
  landmark?: string
}

export interface WorkflowStepSync {
  step_order: number
  guide_id: string
  route_pattern: string
  action_type: 'click' | 'input' | 'select' | 'navigate' | 'hover' | 'info'
  advance_on: 'click' | 'input_valid' | 'route_change' | 'element_appears' | 'manual_next'
  is_optional: boolean
  wait_timeout_ms: number
  condition: Record<string, string> | null
  content: {
    en: { title: string; description: string }
    hi: { title: string; description: string }
  }
  target_fingerprint: TargetFingerprint
}

export interface FeatureSync {
  slug: string
  content: {
    en: { title: string; intent_description: string }
    hi: { title: string; intent_description: string }
  }
  example_queries: string[]
  requires_auth: boolean
  required_role: string | null
  prerequisite_feature_slug: string | null
  steps: WorkflowStepSync[]
}

export interface BuildFlowsResult {
  workflowsPayload: {
    features: FeatureSync[]
  }
  knowledgePayload: {
    sources: Array<{
      source_type: 'code_summary' | 'markdown' | 'faq'
      title: string
      uri?: string
      locale: string
      chunks: string[]
    }>
  }
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

/**
 * Builds resilient target fingerprints matching GuideKit Layered Resolver specifications.
 */
function buildFingerprint(el: InteractiveElement, fallbackGuideId: string): TargetFingerprint {
  const guideId = el.dataGuideId || fallbackGuideId
  const accessibleNames: string[] = []
  if (el.innerText) accessibleNames.push(el.innerText)
  if (el.ariaLabel) accessibleNames.push(el.ariaLabel)
  if (el.placeholder) accessibleNames.push(el.placeholder)

  const attrs: Record<string, string> = {
    'data-guide-id': guideId,
  }
  if (el.dataTestId) attrs['data-testid'] = el.dataTestId
  if (el.id) attrs['id'] = el.id
  if (el.type) attrs['type'] = el.type

  return {
    guide_id: guideId,
    css: el.cssSelector,
    role: el.role || 'button',
    accessible_name: accessibleNames,
    text: el.innerText ? [el.innerText] : [],
    attrs,
    landmark: el.tag === 'form' ? 'form' : el.tag === 'a' ? 'nav' : undefined,
  }
}

/**
 * Maps scanned codebase routes and interactive elements to structured GuideKit workflows.
 */
export function buildFlowsFromCodebase(
  routes: ScannedRoute[],
  desiredFeatureNames: string[] = [
    'Login',
    'Book a Taxi',
    'Become a Driver',
    'Manage Driver Subscription',
    'Ask for Money on the Go',
  ]
): BuildFlowsResult {
  const elementsByRoute = new Map<string, { route: ScannedRoute; elements: InteractiveElement[] }>()

  for (const r of routes) {
    const elements = extractElements(r.filePath)
    elementsByRoute.set(r.routePattern, { route: r, elements })
  }

  const features: FeatureSync[] = []

  // 1. Login flow
  if (desiredFeatureNames.some((f) => /login|sign\s*in/i.test(f))) {
    const loginData = elementsByRoute.get('/login')
    const phoneEl = loginData?.elements.find((e) => e.id === 'phone-input' || e.type === 'tel')
    const submitEl = loginData?.elements.find((e) => e.type === 'submit' || e.tag === 'button')

    const steps: WorkflowStepSync[] = []
    if (phoneEl) {
      steps.push({
        step_order: 1,
        guide_id: 'login-phone-step',
        route_pattern: '/login',
        action_type: 'input',
        advance_on: 'input_valid',
        is_optional: false,
        wait_timeout_ms: 5000,
        condition: null,
        content: {
          en: { title: 'Enter Phone Number', description: 'Type your 10-digit mobile number to receive OTP.' },
          hi: { title: 'फ़ोन नंबर दर्ज करें', description: 'ओटीपी प्राप्त करने के लिए अपना 10 अंकों का मोबाइल नंबर दर्ज करें।' },
        },
        target_fingerprint: buildFingerprint(phoneEl, 'login-phone-step'),
      })
    }
    if (submitEl) {
      steps.push({
        step_order: steps.length + 1,
        guide_id: 'login-submit-step',
        route_pattern: '/login',
        action_type: 'click',
        advance_on: 'click',
        is_optional: false,
        wait_timeout_ms: 5000,
        condition: null,
        content: {
          en: { title: 'Submit OTP', description: 'Click Send OTP to verify your account.' },
          hi: { title: 'ओटीपी सबमिट करें', description: 'अपना खाता सत्यापित करने के लिए ओटीपी भेजें पर क्लिक करें।' },
        },
        target_fingerprint: buildFingerprint(submitEl, 'login-submit-step'),
      })
    }

    features.push({
      slug: 'login',
      content: {
        en: { title: 'Sign In to Taxi Sanchalak', intent_description: 'Authenticate with mobile OTP' },
        hi: { title: 'टैक्सी संचालक में साइन इन करें', intent_description: 'मोबाइल ओटीपी के साथ प्रमाणीकरण करें' },
      },
      example_queries: ['How do I log in?', 'Sign in with phone number', 'लॉग इन कैसे करें?'],
      requires_auth: false,
      required_role: null,
      prerequisite_feature_slug: null,
      steps,
    })
  }

  // 2. Book a Taxi
  if (desiredFeatureNames.some((f) => /book/i.test(f))) {
    const bookData = elementsByRoute.get('/book')
    const pickupEl = bookData?.elements.find((e) => e.id === 'pickup-location' || /pickup/i.test(e.id || ''))
    const dropoffEl = bookData?.elements.find((e) => e.id === 'dropoff-location' || /dropoff/i.test(e.id || ''))
    const bookBtnEl = bookData?.elements.find((e) => e.dataTestId === 'confirm-booking-btn' || /book/i.test(e.id || ''))

    const steps: WorkflowStepSync[] = []
    if (pickupEl) {
      steps.push({
        step_order: 1,
        guide_id: 'book-pickup-step',
        route_pattern: '/book',
        action_type: 'input',
        advance_on: 'input_valid',
        is_optional: false,
        wait_timeout_ms: 5000,
        condition: null,
        content: {
          en: { title: 'Set Pickup Location', description: 'Enter your current address or pickup point.' },
          hi: { title: 'पिकअप स्थान चुनें', description: 'अपना वर्तमान पता या पिकअप पॉइंट दर्ज करें।' },
        },
        target_fingerprint: buildFingerprint(pickupEl, 'book-pickup-step'),
      })
    }
    if (dropoffEl) {
      steps.push({
        step_order: 2,
        guide_id: 'book-dropoff-step',
        route_pattern: '/book',
        action_type: 'input',
        advance_on: 'input_valid',
        is_optional: false,
        wait_timeout_ms: 5000,
        condition: null,
        content: {
          en: { title: 'Set Destination', description: 'Enter where you want to travel to.' },
          hi: { title: 'गंतव्य स्थान चुनें', description: 'वह स्थान दर्ज करें जहाँ आप जाना चाहते हैं।' },
        },
        target_fingerprint: buildFingerprint(dropoffEl, 'book-dropoff-step'),
      })
    }
    if (bookBtnEl) {
      steps.push({
        step_order: steps.length + 1,
        guide_id: 'book-confirm-step',
        route_pattern: '/book',
        action_type: 'click',
        advance_on: 'click',
        is_optional: false,
        wait_timeout_ms: 5000,
        condition: null,
        content: {
          en: { title: 'Confirm Ride', description: 'Tap to dispatch the closest available taxi.' },
          hi: { title: 'सवारी कन्फर्म करें', description: 'निकटतम उपलब्ध टैक्सी भेजने के लिए टैप करें।' },
        },
        target_fingerprint: buildFingerprint(bookBtnEl, 'book-confirm-step'),
      })
    }

    features.push({
      slug: 'book-taxi',
      content: {
        en: { title: 'Book a Taxi', intent_description: 'Search nearby taxis and confirm your ride' },
        hi: { title: 'टैक्सी बुक करें', intent_description: 'आस-पास टैक्सियां खोजें और अपनी सवारी कन्फर्म करें' },
      },
      example_queries: ['Book a cab', 'Find taxi to airport', 'टैक्सी कैसे बुक करें?'],
      requires_auth: true,
      required_role: null,
      prerequisite_feature_slug: 'login',
      steps,
    })
  }

  // 3. Become a Driver
  if (desiredFeatureNames.some((f) => /become.*driver|driver.*register/i.test(f))) {
    const regData = elementsByRoute.get('/driver/register')
    const dlEl = regData?.elements.find((e) => e.id === 'license-number')
    const plateEl = regData?.elements.find((e) => e.id === 'plate-number')
    const submitBtn = regData?.elements.find((e) => e.id === 'driver-register-btn' || e.type === 'submit')

    const steps: WorkflowStepSync[] = []
    if (dlEl) {
      steps.push({
        step_order: 1,
        guide_id: 'driver-reg-license-step',
        route_pattern: '/driver/register',
        action_type: 'input',
        advance_on: 'input_valid',
        is_optional: false,
        wait_timeout_ms: 5000,
        condition: null,
        content: {
          en: { title: 'Enter Driving License', description: 'Provide your commercial driver license number.' },
          hi: { title: 'ड्राइविंग लाइसेंस दर्ज करें', description: 'अपना कमर्शियल ड्राइविंग लाइसेंस नंबर प्रदान करें।' },
        },
        target_fingerprint: buildFingerprint(dlEl, 'driver-reg-license-step'),
      })
    }
    if (plateEl) {
      steps.push({
        step_order: 2,
        guide_id: 'driver-reg-plate-step',
        route_pattern: '/driver/register',
        action_type: 'input',
        advance_on: 'input_valid',
        is_optional: false,
        wait_timeout_ms: 5000,
        condition: null,
        content: {
          en: { title: 'Vehicle Plate Number', description: 'Enter the registered vehicle plate code.' },
          hi: { title: 'वाहन नंबर दर्ज करें', description: 'पंजीकृत वाहन नंबर दर्ज करें।' },
        },
        target_fingerprint: buildFingerprint(plateEl, 'driver-reg-plate-step'),
      })
    }
    if (submitBtn) {
      steps.push({
        step_order: steps.length + 1,
        guide_id: 'driver-reg-submit-step',
        route_pattern: '/driver/register',
        action_type: 'click',
        advance_on: 'click',
        is_optional: false,
        wait_timeout_ms: 5000,
        condition: null,
        content: {
          en: { title: 'Submit Onboarding', description: 'Submit your details for rapid verification.' },
          hi: { title: 'पंजीकरण सबमिट करें', description: 'सत्यापन के लिए अपना विवरण सबमिट करें।' },
        },
        target_fingerprint: buildFingerprint(submitBtn, 'driver-reg-submit-step'),
      })
    }

    features.push({
      slug: 'become-driver',
      content: {
        en: { title: 'Become a Driver Partner', intent_description: 'Register vehicle and commercial license' },
        hi: { title: 'ड्राइवर पार्टनर बनें', intent_description: 'वाहन और कमर्शियल लाइसेंस रजिस्टर करें' },
      },
      example_queries: ['Join as driver', 'How to drive with Taxi Sanchalak', 'ड्राइवर कैसे बनें?'],
      requires_auth: false,
      required_role: null,
      prerequisite_feature_slug: null,
      steps,
    })
  }

  // 4. Manage Driver Subscription
  if (desiredFeatureNames.some((f) => /subscription|sub-plan/i.test(f))) {
    const dashData = elementsByRoute.get('/driver/dashboard')
    const planSelect = dashData?.elements.find((e) => e.id === 'sub-plan' || e.tag === 'select')
    const activateBtn = dashData?.elements.find((e) => e.id === 'activate-sub-btn')

    const steps: WorkflowStepSync[] = []
    if (planSelect) {
      steps.push({
        step_order: 1,
        guide_id: 'driver-sub-tier-step',
        route_pattern: '/driver/dashboard',
        action_type: 'select',
        advance_on: 'click',
        is_optional: false,
        wait_timeout_ms: 5000,
        condition: { role: 'driver' },
        content: {
          en: { title: 'Select Subscription Plan', description: 'Choose between daily, weekly, or monthly zero-commission plans.' },
          hi: { title: 'सब्सक्रिप्शन प्लान चुनें', description: 'दैनिक, साप्ताहिक या मासिक शून्य-कमीशन प्लान चुनें।' },
        },
        target_fingerprint: buildFingerprint(planSelect, 'driver-sub-tier-step'),
      })
    }
    if (activateBtn) {
      steps.push({
        step_order: steps.length + 1,
        guide_id: 'driver-sub-activate-step',
        route_pattern: '/driver/dashboard',
        action_type: 'click',
        advance_on: 'click',
        is_optional: false,
        wait_timeout_ms: 5000,
        condition: { role: 'driver' },
        content: {
          en: { title: 'Activate Subscription', description: 'Click to start your zero-commission plan.' },
          hi: { title: 'सब्सक्रिप्शन सक्रिय करें', description: 'अपना शून्य-कमीशन प्लान शुरू करने के लिए क्लिक करें।' },
        },
        target_fingerprint: buildFingerprint(activateBtn, 'driver-sub-activate-step'),
      })
    }

    features.push({
      slug: 'manage-driver-subscription',
      content: {
        en: { title: 'Manage Driver Subscription', intent_description: 'Choose and activate zero-commission prepaid driver tier' },
        hi: { title: 'ड्राइवर सब्सक्रिप्शन प्रबंधित करें', intent_description: 'शून्य-कमीशन प्रीपेड ड्राइवर टियर चुनें और सक्रिय करें' },
      },
      example_queries: ['Activate subscription', 'Zero commission driver pass', 'ड्राइवर सब्सक्रिप्शन प्लान'],
      requires_auth: true,
      required_role: 'driver',
      prerequisite_feature_slug: 'login',
      steps,
    })
  }

  // 5. Ask for Money on the Go
  if (desiredFeatureNames.some((f) => /money|cash|payout/i.test(f))) {
    const dashData = elementsByRoute.get('/driver/dashboard')
    const amountInput = dashData?.elements.find((e) => e.id === 'payout-amount')
    const payoutBtn = dashData?.elements.find((e) => e.dataTestId === 'instant-payout-cta' || e.id === 'instant-payout-cta')

    const steps: WorkflowStepSync[] = []
    if (amountInput) {
      steps.push({
        step_order: 1,
        guide_id: 'driver-payout-amount-step',
        route_pattern: '/driver/dashboard',
        action_type: 'input',
        advance_on: 'input_valid',
        is_optional: false,
        wait_timeout_ms: 5000,
        condition: { role: 'driver' },
        content: {
          en: { title: 'Enter Payout Amount', description: 'Specify the amount of earned cash to transfer immediately.' },
          hi: { title: 'पेआउट राशि दर्ज करें', description: 'तुरंत ट्रांसफर करने के लिए अर्जित नकद राशि दर्ज करें।' },
        },
        target_fingerprint: buildFingerprint(amountInput, 'driver-payout-amount-step'),
      })
    }
    if (payoutBtn) {
      steps.push({
        step_order: steps.length + 1,
        guide_id: 'driver-payout-cta-step',
        route_pattern: '/driver/dashboard',
        action_type: 'click',
        advance_on: 'click',
        is_optional: false,
        wait_timeout_ms: 5000,
        condition: { role: 'driver' },
        content: {
          en: { title: 'Request Instant Cash', description: 'Tap to transfer money straight to your bank account.' },
          hi: { title: 'तुरंत नकद अनुरोध करें', description: 'सीधे अपने बैंक खाते में पैसे ट्रांसफर करने के लिए टैप करें।' },
        },
        target_fingerprint: buildFingerprint(payoutBtn, 'driver-payout-cta-step'),
      })
    }

    features.push({
      slug: 'ask-money-on-the-go',
      content: {
        en: { title: 'Ask for Money on the Go', intent_description: 'Request instant cash payout while driving' },
        hi: { title: 'चलते-फिरते पैसे मांगें', intent_description: 'ड्राइविंग के दौरान तुरंत कैश पेआउट का अनुरोध करें' },
      },
      example_queries: [
        'How do I ask for money while driving?',
        'Instant driver cash withdrawal',
        'चलते-फिरते पैसे कैसे निकालें?',
      ],
      requires_auth: true,
      required_role: 'driver',
      prerequisite_feature_slug: 'login',
      steps,
    })
  }

  // Knowledge chunks summary from codebase
  const codebaseChunks = [
    'Taxi Sanchalak is an on-demand taxi hailing network connecting passengers and driver partners.',
    'Passengers can book cabs on /book with instant pricing and location selection.',
    'Drivers register via /driver/register and access the driver command center at /driver/dashboard.',
    'Driver features include instant earnings withdrawals and daily zero-commission subscription passes.',
  ]

  return {
    workflowsPayload: { features },
    knowledgePayload: {
      sources: [
        {
          source_type: 'code_summary',
          title: 'Taxi Sanchalak Codebase Summary',
          uri: 'sample-target-app',
          locale: 'en',
          chunks: codebaseChunks,
        },
      ],
    },
  }
}

