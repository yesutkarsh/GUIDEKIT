#!/usr/bin/env python3
"""Idempotent demo-data seeder for the Taxi Sanchalak project.

Run from the ``backend/`` directory::

    python -m scripts.seed_demo_project

The script is fully idempotent: it checks for existing records before
inserting, so it is safe to run multiple times against the same database.

Dependencies:
    * ``DATABASE_URL`` must be set in the environment or in a ``.env`` file
      (read via :mod:`app.core.config`).
    * :mod:`pgvector` is not exercised here; the script does not create any
      embedding rows.
"""

from __future__ import annotations

import asyncio
import hashlib
import sys
import uuid
from datetime import date, timedelta
from pathlib import Path

# ---------------------------------------------------------------------------
# Make sure the backend package is importable when invoked directly.
# ---------------------------------------------------------------------------
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.core.chunker import chunk_document_text
from app.core.config import settings
from app.core.embeddings import embed_texts
from app.core.utils import utcnow
from app.models.identity import Developer, MemberRole, OrgMember, Organization
from app.models.project import KeyType, Project, ProjectKey, ProjectOrigin
from app.models.workflows import (
    Feature,
    FeatureVersion,
    HealSuggestion,
    KnowledgeChunk,
    KnowledgeSource,
    ProjectUsageDaily,
    PublishedManifest,
    TourEvent,
    WorkflowStep,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEMO_EMAIL = "demo@guidekit.dev"
DEMO_ORG_NAME = "Demo Org"
DEMO_ORG_SLUG = "demo-org"
DEMO_PROJECT_NAME = "Taxi Sanchalak"

# Fixed publishable key — sha256 hash stored, plain text returned once only.
DEMO_PK_PLAIN = "gk_pk_live_demo00000000000000000000000000000"
DEMO_PK_PREFIX = DEMO_PK_PLAIN[:12]
DEMO_PK_HASH = hashlib.sha256(DEMO_PK_PLAIN.encode()).hexdigest()

ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://taxisanchalak.com",
]

# Feature definitions -------------------------------------------------------

FEATURES: list[dict] = [
    {
        "slug": "login",
        "requires_auth": False,
        "prerequisite_feature_id": None,
        "required_role": None,
        "content": {
            "en": {
                "title": "Sign In to Taxi Sanchalak",
                "description": "Enter your mobile number to get started.",
            },
            "hi": {
                "title": "टैक्सी संचालक में साइन इन करें",
                "description": "शुरू करने के लिए अपना मोबाइल नंबर दर्ज करें।",
            },
        },
    },
    {
        "slug": "book-taxi",
        "requires_auth": True,
        "prerequisite_feature_id": "login",  # resolved later
        "required_role": None,
        "content": {
            "en": {
                "title": "Book a Taxi",
                "description": "Find and book taxis near you in seconds.",
            },
            "hi": {
                "title": "टैक्सी बुक करें",
                "description": "कुछ ही सेकंड में अपने पास टैक्सी खोजें और बुक करें।",
            },
        },
    },
    {
        "slug": "become-driver",
        "requires_auth": True,
        "prerequisite_feature_id": "login",  # resolved later
        "required_role": "driver",
        "content": {
            "en": {
                "title": "Become a Driver Partner",
                "description": "Register your vehicle and start earning today.",
            },
            "hi": {
                "title": "ड्राइवर पार्टनर बनें",
                "description": "अपना वाहन रजिस्टर करें और आज से कमाई शुरू करें।",
            },
        },
    },
    {
        "slug": "ask-money-on-the-go",
        "requires_auth": True,
        "prerequisite_feature_id": "login",  # resolved later
        "required_role": "driver",
        "content": {
            "en": {
                "title": "Instant Payout",
                "description": "Request your earnings instantly to your bank account.",
            },
            "hi": {
                "title": "तत्काल भुगतान",
                "description": "अपनी कमाई तुरंत अपने बैंक खाते में मांगें।",
            },
        },
    },
]

# Workflow steps per feature (by slug) for the PUBLISHED version -------------

STEPS_BY_FEATURE: dict[str, list[dict]] = {
    "login": [
        {
            "step_order": 1,
            "guide_id": "login-step-1",
            "route_pattern": "/login",
            "action_type": "input",
            "advance_on": "input_valid",
            "content": {
                "en": {"popover": "Enter your registered mobile number"},
                "hi": {"popover": "अपना पंजीकृत मोबाइल नंबर दर्ज करें"},
            },
            "target_fingerprint": {
                "selector": "#mobile-input",
                "tag": "INPUT",
                "type": "tel",
                "data-testid": "mobile-field",
            },
        },
        {
            "step_order": 2,
            "guide_id": "login-step-2",
            "route_pattern": "/login",
            "action_type": "click",
            "advance_on": "route_change",
            "content": {
                "en": {"popover": "Click Send OTP to verify your number"},
                "hi": {"popover": "अपना नंबर सत्यापित करने के लिए OTP भेजें पर क्लिक करें"},
            },
            "target_fingerprint": {
                "selector": ".btn-send-otp",
                "tag": "BUTTON",
                "data-testid": "send-otp-btn",
            },
        },
    ],
    "book-taxi": [
        {
            "step_order": 1,
            "guide_id": "book-taxi-step-1",
            "route_pattern": "/",
            "action_type": "input",
            "advance_on": "input_valid",
            "content": {
                "en": {"popover": "Type your pickup location"},
                "hi": {"popover": "अपना पिकअप स्थान टाइप करें"},
            },
            "target_fingerprint": {
                "selector": "#pickup-input",
                "tag": "INPUT",
                "data-testid": "pickup-location",
            },
        },
        {
            "step_order": 2,
            "guide_id": "book-taxi-step-2",
            "route_pattern": "/",
            "action_type": "click",
            "advance_on": "element_appears",
            "content": {
                "en": {"popover": "Tap to find available taxis"},
                "hi": {"popover": "उपलब्ध टैक्सियां खोजने के लिए टैप करें"},
            },
            "target_fingerprint": {
                "selector": ".search-taxis-btn",
                "tag": "BUTTON",
                "data-testid": "find-taxis",
            },
        },
        {
            "step_order": 3,
            "guide_id": "book-taxi-step-3",
            "route_pattern": "/results",
            "action_type": "click",
            "advance_on": "route_change",
            "content": {
                "en": {"popover": "Select the first available taxi to proceed"},
                "hi": {"popover": "आगे बढ़ने के लिए पहली उपलब्ध टैक्सी चुनें"},
            },
            "target_fingerprint": {
                "selector": ".taxi-card:first-child .book-btn",
                "tag": "BUTTON",
                "data-testid": "book-taxi-cta",
            },
        },
    ],
    "become-driver": [
        {
            "step_order": 1,
            "guide_id": "driver-reg-step-1",
            "route_pattern": "/register/driver",
            "action_type": "input",
            "advance_on": "input_valid",
            "content": {
                "en": {"popover": "Enter your vehicle registration number"},
                "hi": {"popover": "अपना वाहन पंजीकरण नंबर दर्ज करें"},
            },
            "target_fingerprint": {
                "selector": "#vehicle-reg",
                "tag": "INPUT",
                "data-testid": "vehicle-reg-input",
            },
        },
        {
            "step_order": 2,
            "guide_id": "driver-reg-step-2",
            "route_pattern": "/register/driver",
            "action_type": "click",
            "advance_on": "route_change",
            "content": {
                "en": {"popover": "Submit your registration"},
                "hi": {"popover": "अपना पंजीकरण सबमिट करें"},
            },
            "target_fingerprint": {
                "selector": ".submit-reg-btn",
                "tag": "BUTTON",
                "data-testid": "submit-driver-reg",
            },
        },
    ],
    "ask-money-on-the-go": [
        {
            "step_order": 1,
            "guide_id": "payout-step-1",
            "route_pattern": "/driver/earnings",
            "action_type": "click",
            "advance_on": "element_appears",
            "content": {
                "en": {"popover": "Click Instant Payout to withdraw earnings"},
                "hi": {"popover": "कमाई निकालने के लिए तत्काल भुगतान पर क्लिक करें"},
            },
            "target_fingerprint": {
                "selector": ".btn-payout",
                "tag": "BUTTON",
                "data-testid": "instant-payout-cta",
            },
        },
        {
            "step_order": 2,
            "guide_id": "payout-step-2",
            "route_pattern": "/driver/earnings/confirm",
            "action_type": "input",
            "advance_on": "input_valid",
            "content": {
                "en": {"popover": "Enter the amount you want to withdraw"},
                "hi": {"popover": "वह राशि दर्ज करें जो आप निकालना चाहते हैं"},
            },
            "target_fingerprint": {
                "selector": "#payout-amount",
                "tag": "INPUT",
                "data-testid": "payout-amount-field",
            },
        },
    ],
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Main seed routine
# ---------------------------------------------------------------------------


async def main() -> None:  # noqa: C901 — intentionally long for readability
    engine = create_async_engine(settings.database_url, echo=False)

    async with AsyncSession(engine) as session:
        now = utcnow()

        # ----------------------------------------------------------------
        # 1. Developer
        # ----------------------------------------------------------------
        developer = await session.scalar(
            select(Developer).where(Developer.email == DEMO_EMAIL)
        )
        if developer is None:
            developer = Developer(
                email=DEMO_EMAIL,
                display_name="Demo Developer",
                auth_provider="google",
                auth_provider_id="seed-demo-developer",
            )
            session.add(developer)
            await session.flush()
            print(f"  [+] Developer created: {DEMO_EMAIL}")
        else:
            print(f"  [=] Developer already exists: {DEMO_EMAIL}")

        # ----------------------------------------------------------------
        # 2. Organization
        # ----------------------------------------------------------------
        org = await session.scalar(
            select(Organization).where(Organization.slug == DEMO_ORG_SLUG)
        )
        if org is None:
            org = Organization(name=DEMO_ORG_NAME, slug=DEMO_ORG_SLUG)
            session.add(org)
            await session.flush()
            print(f"  [+] Organization created: {DEMO_ORG_SLUG}")
        else:
            print(f"  [=] Organization already exists: {DEMO_ORG_SLUG}")

        # Membership
        member = await session.scalar(
            select(OrgMember).where(
                OrgMember.org_id == org.id,
                OrgMember.developer_id == developer.id,
            )
        )
        if member is None:
            session.add(
                OrgMember(
                    org_id=org.id,
                    developer_id=developer.id,
                    role=MemberRole.OWNER.value,
                )
            )
            await session.flush()
            print("  [+] OrgMember added")

        # ----------------------------------------------------------------
        # 3. Project
        # ----------------------------------------------------------------
        project = await session.scalar(
            select(Project).where(
                Project.org_id == org.id,
                Project.name == DEMO_PROJECT_NAME,
            )
        )
        if project is None:
            project = Project(
                org_id=org.id,
                name=DEMO_PROJECT_NAME,
                slug="taxi-sanchalak",
                framework="sveltekit",
                default_locale="en",
                supported_locales=["en", "hi"],
                auth_detection_config={"type": "localStorage", "key": "taxi_user"},
                chat_settings={},
            )
            session.add(project)
            await session.flush()
            print(f"  [+] Project created: {DEMO_PROJECT_NAME}")
        else:
            print(f"  [=] Project already exists: {DEMO_PROJECT_NAME}")

        # ----------------------------------------------------------------
        # 4. Origins
        # ----------------------------------------------------------------
        for origin_url in ORIGINS:
            existing = await session.scalar(
                select(ProjectOrigin).where(
                    ProjectOrigin.project_id == project.id,
                    ProjectOrigin.origin == origin_url,
                )
            )
            if existing is None:
                session.add(
                    ProjectOrigin(
                        project_id=project.id,
                        origin=origin_url,
                        environment=(
                            "production"
                            if "taxisanchalak.com" in origin_url
                            else "development"
                        ),
                    )
                )
                print(f"  [+] Origin added: {origin_url}")

        await session.flush()

        # ----------------------------------------------------------------
        # 5. Publishable key
        # ----------------------------------------------------------------
        pk_row = await session.scalar(
            select(ProjectKey).where(ProjectKey.key_hash == DEMO_PK_HASH)
        )
        if pk_row is None:
            pk_row = ProjectKey(
                project_id=project.id,
                key_type=KeyType.PUBLISHABLE.value,
                key_prefix=DEMO_PK_PREFIX,
                key_hash=DEMO_PK_HASH,
                key_plain=DEMO_PK_PLAIN,
                label="Demo publishable key",
                created_by=developer.id,
            )
            session.add(pk_row)
            await session.flush()
            print(f"  [+] Publishable key created: {DEMO_PK_PLAIN}")
        else:
            print(f"  [=] Publishable key already exists: {DEMO_PK_PLAIN}")

        # ----------------------------------------------------------------
        # 6-7. Features + FeatureVersions
        # ----------------------------------------------------------------
        feature_map: dict[str, Feature] = {}  # slug -> Feature
        published_version_map: dict[str, FeatureVersion] = {}  # slug -> published FV

        for feature_def in FEATURES:
            slug: str = feature_def["slug"]

            feat = await session.scalar(
                select(Feature).where(
                    Feature.project_id == project.id,
                    Feature.slug == slug,
                )
            )
            if feat is None:
                feat = Feature(
                    project_id=project.id,
                    slug=slug,
                    created_by=developer.id,
                )
                session.add(feat)
                await session.flush()
                print(f"  [+] Feature created: {slug}")
            else:
                print(f"  [=] Feature already exists: {slug}")

            feature_map[slug] = feat

        await session.flush()

        # ----------------------------------------------------------------
        # 7 & 8. FeatureVersions & WorkflowSteps
        # ----------------------------------------------------------------
        # Due to DB trigger forbid_edit_of_non_draft_steps(), WorkflowSteps can
        # only be inserted while the FeatureVersion has status='draft'.
        # We create version 1 as 'draft', insert its WorkflowSteps, and then
        # transition version 1 to 'published'. After that, version 2 is created
        # as 'draft' with duplicate steps so both versions have populated steps.
        # ----------------------------------------------------------------
        payout_step_1: WorkflowStep | None = None  # used for HealSuggestions

        for feature_def in FEATURES:
            slug = feature_def["slug"]
            feat = feature_map[slug]

            prereq_slug = feature_def.get("prerequisite_feature_id")
            prereq_id: uuid.UUID | None = None
            if prereq_slug and prereq_slug in feature_map:
                prereq_id = feature_map[prereq_slug].id

            # ----- Published version (version_number=1) -----
            pub_fv = await session.scalar(
                select(FeatureVersion).where(
                    FeatureVersion.feature_id == feat.id,
                    FeatureVersion.version_number == 1,
                )
            )
            if pub_fv is None:
                # 1. Create version 1 as draft so steps can be attached
                pub_fv = FeatureVersion(
                    feature_id=feat.id,
                    project_id=project.id,
                    version_number=1,
                    status="draft",
                    content=feature_def["content"],
                    example_queries=[],
                    requires_auth=feature_def["requires_auth"],
                    required_role=feature_def.get("required_role"),
                    prerequisite_feature_id=prereq_id,
                    created_by=developer.id,
                )
                session.add(pub_fv)
                await session.flush()

                # 2. Insert workflow steps for version 1
                step_defs = STEPS_BY_FEATURE.get(slug, [])
                for step_def in step_defs:
                    step = WorkflowStep(
                        project_id=project.id,
                        feature_version_id=pub_fv.id,
                        step_order=step_def["step_order"],
                        guide_id=step_def["guide_id"],
                        route_pattern=step_def["route_pattern"],
                        action_type=step_def["action_type"],
                        advance_on=step_def["advance_on"],
                        content=step_def["content"],
                        target_fingerprint=step_def["target_fingerprint"],
                    )
                    session.add(step)
                    await session.flush()

                    if slug == "ask-money-on-the-go" and step_def["step_order"] == 1:
                        payout_step_1 = step

                # 3. Publish version 1
                pub_fv.status = "published"
                pub_fv.published_at = now
                pub_fv.published_by = developer.id
                await session.flush()
                print(f"  [+] Published FeatureVersion + steps created: {slug} v1")
            else:
                print(f"  [=] Published FeatureVersion already exists: {slug}")
                if slug == "ask-money-on-the-go":
                    payout_step_1 = await session.scalar(
                        select(WorkflowStep).where(
                            WorkflowStep.feature_version_id == pub_fv.id,
                            WorkflowStep.step_order == 1,
                        )
                    )

            published_version_map[slug] = pub_fv

            # ----- Draft version (version_number=2) -----
            draft_fv = await session.scalar(
                select(FeatureVersion).where(
                    FeatureVersion.feature_id == feat.id,
                    FeatureVersion.version_number == 2,
                )
            )
            if draft_fv is None:
                draft_fv = FeatureVersion(
                    feature_id=feat.id,
                    project_id=project.id,
                    version_number=2,
                    status="draft",
                    content=feature_def["content"],
                    example_queries=[],
                    requires_auth=feature_def["requires_auth"],
                    required_role=feature_def.get("required_role"),
                    prerequisite_feature_id=prereq_id,
                    created_by=developer.id,
                )
                session.add(draft_fv)
                await session.flush()

                # Also copy steps to the draft version
                step_defs = STEPS_BY_FEATURE.get(slug, [])
                for step_def in step_defs:
                    draft_step = WorkflowStep(
                        project_id=project.id,
                        feature_version_id=draft_fv.id,
                        step_order=step_def["step_order"],
                        guide_id=step_def["guide_id"],
                        route_pattern=step_def["route_pattern"],
                        action_type=step_def["action_type"],
                        advance_on=step_def["advance_on"],
                        content=step_def["content"],
                        target_fingerprint=step_def["target_fingerprint"],
                    )
                    session.add(draft_step)
                await session.flush()
                print(f"  [+] Draft FeatureVersion + steps created: {slug} v2")
            else:
                print(f"  [=] Draft FeatureVersion already exists: {slug}")

        await session.flush()

        # ----------------------------------------------------------------
        # 9. HealSuggestions for payout step 1
        # ----------------------------------------------------------------
        if payout_step_1 is not None:
            heal_data = [
                {
                    "suggested_fingerprint": {
                        "selector": '[data-testid="instant-payout-cta"]',
                        "tag": "BUTTON",
                        "data-testid": "instant-payout-cta",
                    },
                    "suggested_selector": '[data-testid="instant-payout-cta"]',
                    "confidence": 0.94,
                    "occurrences": 12,
                    "status": "pending",
                },
                {
                    "suggested_fingerprint": {
                        "selector": ".payout-primary-action",
                        "tag": "BUTTON",
                        "aria-label": "Request instant payout",
                    },
                    "suggested_selector": ".payout-primary-action",
                    "confidence": 0.78,
                    "occurrences": 3,
                    "status": "pending",
                },
            ]
            for hd in heal_data:
                existing_heal = await session.scalar(
                    select(HealSuggestion).where(
                        HealSuggestion.step_id == payout_step_1.id,
                        HealSuggestion.suggested_selector == hd["suggested_selector"],
                        HealSuggestion.status == "pending",
                    )
                )
                if existing_heal is None:
                    session.add(
                        HealSuggestion(
                            project_id=project.id,
                            step_id=payout_step_1.id,
                            suggested_fingerprint=hd["suggested_fingerprint"],
                            suggested_selector=hd["suggested_selector"],
                            confidence=hd["confidence"],
                            occurrences=hd["occurrences"],
                            status=hd["status"],
                        )
                    )
                    print(f"  [+] HealSuggestion created: {hd['suggested_selector']}")
                else:
                    print(
                        f"  [=] HealSuggestion already exists: {hd['suggested_selector']}"
                    )

        await session.flush()

        # ----------------------------------------------------------------
        # 10. TourEvents
        # ----------------------------------------------------------------
        book_taxi_pub_fv = published_version_map["book-taxi"]

        existing_tour_count = await session.scalar(
            select(TourEvent.id).where(TourEvent.project_id == project.id)
        )
        if existing_tour_count is None:
            tour_event_counts = {
                "started": 50,
                "step_completed": 42,
                "completed": 35,
                "exited": 8,
                "failed": 5,
            }
            for event_type, count in tour_event_counts.items():
                for _ in range(count):
                    session.add(
                        TourEvent(
                            project_id=project.id,
                            feature_version_id=book_taxi_pub_fv.id,
                            event_type=event_type,
                        )
                    )
            await session.flush()
            print("  [+] TourEvents created")
        else:
            print("  [=] TourEvents already exist")

        # ----------------------------------------------------------------
        # 11. ProjectUsageDaily (past 7 days)
        # ----------------------------------------------------------------
        today = date.today()
        daily_data = [
            (today - timedelta(days=i), 100 + i * 15, 20 + i * 3)
            for i in range(7)
        ]
        for day, chat_msgs, ai_res in daily_data:
            existing_daily = await session.scalar(
                select(ProjectUsageDaily).where(
                    ProjectUsageDaily.project_id == project.id,
                    ProjectUsageDaily.day == day,
                )
            )
            if existing_daily is None:
                session.add(
                    ProjectUsageDaily(
                        project_id=project.id,
                        day=day,
                        chat_messages=chat_msgs,
                        ai_resolutions=ai_res,
                        tts_characters=0,
                    )
                )
                print(f"  [+] ProjectUsageDaily created: {day}")
            else:
                print(f"  [=] ProjectUsageDaily already exists: {day}")

        await session.flush()

        # ----------------------------------------------------------------
        # 12. PublishedManifest
        # ----------------------------------------------------------------
        existing_manifest = await session.scalar(
            select(PublishedManifest).where(
                PublishedManifest.project_id == project.id,
                PublishedManifest.is_current.is_(True),
            )
        )
        if existing_manifest is None:
            session.add(
                PublishedManifest(
                    project_id=project.id,
                    manifest_version=1,
                    etag="v1-taxi-sanchalak",
                    storage_key="manifests/taxi-sanchalak/v1.json",
                    byte_size=8192,
                    feature_count=4,
                    is_current=True,
                    published_by=developer.id,
                )
            )
            await session.flush()
            print("  [+] PublishedManifest created")
        else:
            print("  [=] PublishedManifest already exists")

        # ----------------------------------------------------------------
        # 13. Knowledge Base / RAG Seed Documents
        # ----------------------------------------------------------------
        demo_docs = [
            {
                "title": "Ride Cancellation & Refund Policy",
                "source_type": "faq",
                "content": (
                    "Riders may cancel their booking free of charge within 5 minutes of driver confirmation. "
                    "After 5 minutes, a standard cancellation fee of ₹50 applies to compensate the driver for fuel. "
                    "If the assigned driver is delayed by more than 10 minutes past the estimated pickup time, riders can cancel with zero penalty. "
                    "All refunds are credited automatically back to the original UPI, debit card, or wallet balance within 3 to 5 business days. "
                    "For disputed cancellation charges, riders can contact 24/7 in-app support for an immediate fare review."
                ),
            },
            {
                "title": "Driver Earnings & Daily Payout FAQ",
                "source_type": "faq",
                "content": (
                    "Taxi Sanchalak drivers receive automatic daily bank payouts at 11:59 PM every night with zero platform commissions. "
                    "Instant on-demand cashout is available directly inside the Driver App for a flat fee of ₹5 per withdrawal. "
                    "Drivers are required to maintain a minimum wallet float of ₹100 for toll booths and state border permits. "
                    "Surge pricing bonuses and peak-hour incentives are calculated automatically and credited to the driver wallet immediately upon trip completion."
                ),
            },
            {
                "title": "Passenger Safety & Privacy Policy",
                "source_type": "markdown",
                "content": (
                    "Taxi Sanchalak protects rider privacy with automatic number masking and encrypted GPS tracking. "
                    "Drivers never see your real mobile phone number; all calls and messages are routed through private virtual proxies. "
                    "Riders can share their real-time trip route with up to 5 emergency contacts with one tap via SMS or WhatsApp. "
                    "Our emergency SOS button links directly to local law enforcement dispatch (112) with immediate vehicle telemetry and coordinates."
                ),
            },
        ]

        for doc in demo_docs:
            existing_src = await session.scalar(
                select(KnowledgeSource).where(
                    KnowledgeSource.project_id == project.id,
                    KnowledgeSource.title == doc["title"],
                )
            )
            if existing_src is None:
                src_row = KnowledgeSource(
                    id=uuid.uuid4(),
                    project_id=project.id,
                    source_type=doc["source_type"],
                    title=doc["title"],
                    uri=None,
                    content_hash=hashlib.sha256(doc["content"].encode()).hexdigest(),
                    status="indexed",
                    created_by=developer.id,
                )
                session.add(src_row)
                await session.flush()

                chunks = chunk_document_text(doc["content"], max_chars=400, overlap_chars=50)
                chunk_texts = [c["content"] for c in chunks]
                vectors = await embed_texts(chunk_texts)
                for idx, (chunk_info, vec) in enumerate(zip(chunks, vectors)):
                    session.add(
                        KnowledgeChunk(
                            project_id=project.id,
                            source_id=src_row.id,
                            locale="en",
                            chunk_index=chunk_info["chunk_index"],
                            content=chunk_info["content"],
                            embedding=vec,
                            meta={"title": doc["title"], "char_count": chunk_info["char_count"]},
                        )
                    )
                print(f"  [+] KnowledgeSource created: {doc['title']} ({len(chunks)} chunks)")
            else:
                print(f"  [=] KnowledgeSource already exists: {doc['title']}")

        await session.flush()

        # ----------------------------------------------------------------
        # Commit everything
        # ----------------------------------------------------------------
        await session.commit()
        print("\n✅  Demo seed complete.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
