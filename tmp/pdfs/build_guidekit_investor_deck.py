from __future__ import annotations

from pathlib import Path
from typing import Iterable

from reportlab.lib.colors import Color, HexColor
from reportlab.lib.pagesizes import landscape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas
from reportlab.lib.utils import ImageReader


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "output" / "pdf" / "guidekit-investor-overview.pdf"
CHATBOT_EXAMPLES_IMAGE = ROOT / "tmp" / "pdfs" / "chatbot-question-examples.png"

PAGE_W, PAGE_H = landscape((540, 960))

INK = HexColor("#171A18")
MUTED = HexColor("#65706A")
SUBTLE = HexColor("#8A948E")
CANVAS = HexColor("#F4F6F1")
SURFACE = HexColor("#FFFFFF")
SOFT = HexColor("#E9EEE8")
BORDER = HexColor("#DDE4DE")
EMERALD = HexColor("#087A55")
EMERALD_DARK = HexColor("#055F42")
EMERALD_SOFT = HexColor("#DFF2E9")
MINT = HexColor("#BCE8D4")
LIME = HexColor("#D7EE7B")
AMBER = HexColor("#F2C66D")
AMBER_SOFT = HexColor("#FFF2D6")
BLUE = HexColor("#6EA6C8")
BLUE_SOFT = HexColor("#E2F0F7")
RED = HexColor("#B84848")
RED_SOFT = HexColor("#F9E4E1")

FONT_REG = "/System/Library/Fonts/Supplemental/Arial.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
pdfmetrics.registerFont(TTFont("GuideKit", FONT_REG))
pdfmetrics.registerFont(TTFont("GuideKit-Bold", FONT_BOLD))


def rounded(c: Canvas, x: float, y: float, w: float, h: float, r: float, fill, stroke=None, sw=1):
    c.setFillColor(fill)
    if stroke:
        c.setStrokeColor(stroke)
        c.setLineWidth(sw)
        c.roundRect(x, y, w, h, r, fill=1, stroke=1)
    else:
        c.roundRect(x, y, w, h, r, fill=1, stroke=0)


def line(c: Canvas, x1, y1, x2, y2, color=BORDER, width=1):
    c.setStrokeColor(color)
    c.setLineWidth(width)
    c.line(x1, y1, x2, y2)


def words(text: str, font: str, size: float, max_width: float) -> list[str]:
    out: list[str] = []
    current = ""
    for token in text.split():
        trial = token if not current else f"{current} {token}"
        if pdfmetrics.stringWidth(trial, font, size) <= max_width:
            current = trial
        elif current:
            out.append(current)
            current = token
        else:
            out.append(token)
            current = ""
    if current:
        out.append(current)
    return out


def text(c: Canvas, value: str, x: float, y: float, size=18, color=INK, font="GuideKit", leading=None,
         max_width=None, max_lines=None, align="left") -> float:
    if leading is None:
        leading = size * 1.28
    lines: list[str] = []
    for paragraph in value.split("\n"):
        lines.extend(words(paragraph, font, size, max_width) if max_width else [paragraph])
    if max_lines:
        lines = lines[:max_lines]
    c.setFont(font, size)
    c.setFillColor(color)
    cursor = y
    for item in lines:
        if align == "center":
            c.drawCentredString(x, cursor, item)
        elif align == "right":
            c.drawRightString(x, cursor, item)
        else:
            c.drawString(x, cursor, item)
        cursor -= leading
    return cursor


def label(c: Canvas, value: str, x: float, y: float, color=EMERALD):
    c.setFillColor(color)
    c.setFont("GuideKit-Bold", 10)
    c.drawString(x, y, value.upper())


def pill(c: Canvas, value: str, x: float, y: float, fill=EMERALD_SOFT, color=EMERALD_DARK, pad_x=12, h=25):
    w = pdfmetrics.stringWidth(value, "GuideKit-Bold", 10) + pad_x * 2
    rounded(c, x, y, w, h, h / 2, fill)
    text(c, value, x + pad_x, y + 8, 10, color, "GuideKit-Bold")
    return w


def number_badge(c: Canvas, n: str, x: float, y: float, fill=INK, color=SURFACE):
    c.setFillColor(fill)
    c.circle(x, y, 14, fill=1, stroke=0)
    text(c, n, x, y - 4, 10, color, "GuideKit-Bold", align="center")


def footer(c: Canvas, page: int, section: str):
    line(c, 48, 30, PAGE_W - 48, 30, SOFT, 0.7)
    text(c, "GUIDEKIT", 48, 15, 8, SUBTLE, "GuideKit-Bold")
    text(c, section, PAGE_W / 2, 15, 8, SUBTLE, align="center")
    text(c, f"{page:02d}", PAGE_W - 48, 15, 8, SUBTLE, "GuideKit-Bold", align="right")


def page_base(c: Canvas, page: int, section: str, dark=False):
    c.setFillColor(INK if dark else CANVAS)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    if not dark:
        footer(c, page, section)


def circle_glow(c: Canvas, x: float, y: float, radius: float, color, alpha=0.18):
    c.saveState()
    c.setFillColor(color)
    c.setFillAlpha(alpha)
    c.circle(x, y, radius, fill=1, stroke=0)
    c.restoreState()


def arrow(c: Canvas, x1, y1, x2, y2, color=EMERALD, width=2):
    c.setStrokeColor(color)
    c.setFillColor(color)
    c.setLineWidth(width)
    c.line(x1, y1, x2 - 7, y2)
    c.line(x2 - 8, y2 + 4, x2, y2)
    c.line(x2 - 8, y2 - 4, x2, y2)


def clipped_image(c: Canvas, path: Path, x: float, y: float, w: float, h: float, radius: float = 16):
    c.saveState()
    clip = c.beginPath()
    clip.roundRect(x, y, w, h, radius)
    c.clipPath(clip, stroke=0, fill=0)
    c.drawImage(ImageReader(str(path)), x, y, width=w, height=h, preserveAspectRatio=False, mask="auto")
    c.restoreState()
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.8)
    c.roundRect(x, y, w, h, radius, fill=0, stroke=1)


def card_title(c: Canvas, title_value: str, body: str, x: float, y: float, w: float, h: float,
               accent=EMERALD, number=None, fill=SURFACE):
    rounded(c, x, y, w, h, 16, fill, BORDER, 0.8)
    c.setFillColor(accent)
    c.roundRect(x + 16, y + h - 10, 42, 4, 2, fill=1, stroke=0)
    if number:
        number_badge(c, number, x + 31, y + h - 35, accent)
        tx = x + 55
    else:
        tx = x + 18
    text(c, title_value, tx, y + h - 42, 15, INK, "GuideKit-Bold", max_width=w - (tx - x) - 18)
    text(c, body, x + 18, y + h - 73, 10.5, MUTED, max_width=w - 36, leading=14)


def title_block(c: Canvas, kicker: str, heading: str, sub: str, page: int, section: str):
    label(c, kicker, 52, 496)
    text(c, heading, 52, 462, 31, INK, "GuideKit-Bold", max_width=820, leading=36)
    text(c, sub, 52, 390, 13, MUTED, max_width=790, leading=18)
    footer(c, page, section)


def cover(c: Canvas):
    page_base(c, 1, "Investor overview", dark=True)
    circle_glow(c, 812, 470, 225, EMERALD, 0.48)
    circle_glow(c, 866, 108, 148, BLUE, 0.26)
    circle_glow(c, 664, 152, 82, LIME, 0.24)

    rounded(c, 52, 486, 92, 30, 15, EMERALD)
    text(c, "GUIDEKIT", 70, 496, 10, SURFACE, "GuideKit-Bold")
    text(c, "The AI assistant", 52, 390, 43, SURFACE, "GuideKit-Bold")
    text(c, "inside every", 52, 340, 43, MINT, "GuideKit-Bold")
    text(c, "digital product.", 52, 290, 43, SURFACE, "GuideKit-Bold")
    text(c, "Grounded answers from company knowledge. The right tool when users\nneed to take action. One chatbot embedded on the website.",
         54, 226, 15, HexColor("#D5DDD7"), max_width=500, leading=21)
    pill(c, "Investor overview", 54, 112, fill=Color(1, 1, 1, alpha=0.12), color=SURFACE)
    text(c, "NOVEMBER 2026", 54, 78, 9, HexColor("#9FAAA3"), "GuideKit-Bold")

    # Right-side product system visual
    rounded(c, 632, 274, 260, 166, 20, HexColor("#F8FAF7"))
    text(c, "GUIDEBOT", 654, 410, 10, EMERALD, "GuideKit-Bold")
    text(c, "How can we help?", 654, 383, 18, INK, "GuideKit-Bold")
    rounded(c, 654, 321, 216, 42, 10, SOFT)
    c.setStrokeColor(EMERALD)
    c.setLineWidth(3)
    c.line(670, 342, 688, 342)
    text(c, "Ask about policy or take action", 702, 337, 10.5, INK, "GuideKit-Bold")
    text(c, "Embedded directly in the customer's site", 654, 296, 10, MUTED)

    rounded(c, 692, 104, 200, 126, 18, HexColor("#0C2A20"))
    text(c, "INTELLIGENCE", 712, 204, 10, MINT, "GuideKit-Bold")
    text(c, "Answer or act", 712, 169, 21, SURFACE, "GuideKit-Bold")
    text(c, "RAG. Tools. Guided workflows.", 712, 142, 10.5, HexColor("#C9D8D0"))
    rounded(c, 712, 118, 116, 18, 9, EMERALD)
    text(c, "Grounded by design", 723, 124, 8, SURFACE, "GuideKit-Bold")


def problem(c: Canvas):
    page_base(c, 2, "The problem")
    label(c, "Problem statement", 52, 496)
    text(c, "Most website chatbots\nstop at the answer.", 52, 448, 31, INK, "GuideKit-Bold", leading=38)
    text(c, "Users need trusted answers and a way to complete the task - without leaving the conversation.",
         52, 341, 12.5, MUTED, max_width=330, leading=17)

    rounded(c, 52, 215, 330, 72, 14, INK)
    text(c, "GUIDEKIT", 72, 263, 9, MINT, "GuideKit-Bold")
    text(c, "RAG + tools + guided actions", 72, 237, 15, SURFACE, "GuideKit-Bold")

    clipped_image(c, CHATBOT_EXAMPLES_IMAGE, 425, 150, 483, 270, 19)
    footer(c, 2, "The problem")


def solution(c: Canvas):
    page_base(c, 3, "The solution")
    title_block(c, "Proposed solution", "Embed one intelligent assistant that knows the business and its product.",
                "GuideKit gives companies a website chatbot that routes each request to the right capability: a grounded answer, a configured tool, or an interactive guided workflow.",
                3, "The solution")

    nodes = [
        (58, "1", "Embed", "Add the GuideKit SDK and branded chat widget to the website.", EMERALD),
        (279, "2", "Ground", "Upload policies, documentation, FAQs, and product knowledge.", BLUE),
        (500, "3", "Connect tools", "Map user intents to actions and guided product workflows.", AMBER),
        (721, "4", "Assist", "Answer questions or help the user complete the requested task.", EMERALD),
    ]
    for i, (x, n, name, body, accent) in enumerate(nodes):
        rounded(c, x, 150, 181, 174, 16, SURFACE, BORDER, 0.8)
        number_badge(c, n, x + 30, 290, accent)
        text(c, name, x + 18, 248, 19, INK, "GuideKit-Bold")
        text(c, body, x + 18, 216, 11, MUTED, max_width=145, leading=15)
        if i < len(nodes) - 1:
            arrow(c, x + 184, 234, x + 213, 234, EMERALD, 1.5)

    pill(c, "One conversational entry point", 52, 92, EMERALD_SOFT, EMERALD_DARK)
    text(c, "Users do not need to know whether their request requires knowledge, a tool, or a workflow.", 260, 100, 12, MUTED)


def journey(c: Canvas):
    page_base(c, 4, "Customer experience")
    title_block(c, "End-user experience", "One question. The right path. A useful outcome.",
                "GuideKit hides the orchestration complexity. The user simply chats, while the system decides whether to retrieve knowledge or invoke an available capability.",
                4, "Customer experience")

    steps = [
        ("01", "Ask", "The user describes a question or goal in natural language."),
        ("02", "Understand", "Gemini classifies intent and checks available knowledge and tools."),
        ("03", "Retrieve", "Relevant company content is retrieved and attached as grounding."),
        ("04", "Answer or act", "GuideBot replies, surfaces a tool, or launches a guided workflow."),
        ("05", "Complete", "The user gets a supported answer or reaches the intended outcome."),
    ]
    left = 54
    top = 326
    gap = 168
    for i, (n, heading, body) in enumerate(steps):
        x = left + i * gap
        c.setFillColor(EMERALD if i in (0, 4) else INK)
        c.circle(x + 23, top, 23, fill=1, stroke=0)
        text(c, n, x + 23, top - 4, 10, SURFACE, "GuideKit-Bold", align="center")
        if i < 4:
            line(c, x + 47, top, x + gap - 3, top, BORDER, 2)
        text(c, heading, x, 272, 14, INK, "GuideKit-Bold", max_width=142)
        text(c, body, x, 244, 9.8, MUTED, max_width=138, leading=13.5)

    rounded(c, 52, 82, 856, 86, 16, EMERALD_DARK)
    text(c, "The user never has to choose between chat, search, and product navigation", 72, 135, 16, SURFACE, "GuideKit-Bold")
    text(c, "GuideKit selects the best available route and keeps the conversation connected to the user's current page and product context.",
         72, 108, 10.5, HexColor("#D3E6DD"), max_width=770, leading=14)


def architecture(c: Canvas):
    page_base(c, 5, "Solution architecture")
    label(c, "Solution architecture", 52, 496)
    text(c, "A conversational orchestration layer between users and the product.", 52, 458, 28, INK, "GuideKit-Bold", max_width=820)
    text(c, "The website widget, knowledge system, tool registry, and model layer work together behind one simple interface.", 52, 382, 13, MUTED)

    # Columns
    column_data = [
        (52, 218, "COMPANY SETUP", EMERALD_SOFT, EMERALD_DARK,
         [("Dashboard", "Projects, knowledge sources, tools, analytics"), ("Developer integration", "Publishable key, origins, SDK, optional IDE workflow")]),
        (371, 218, "GUIDEKIT ORCHESTRATION", BLUE_SOFT, HexColor("#275B77"),
         [("Intent router", "Question, tool request, guided workflow, guardrail"), ("RAG + pgvector", "Chunk, embed, retrieve, and ground"), ("Tool + workflow layer", "Configured actions and product navigation")]),
        (690, 218, "WEBSITE EXPERIENCE", AMBER_SOFT, HexColor("#76571A"),
         [("GuideBot widget", "Natural-language chat in the customer's site"), ("Outcome", "Grounded answer, tool, or interactive guidance")]),
    ]
    for x, w, heading, fill, accent, items in column_data:
        rounded(c, x, 96, w, 278, 17, SURFACE, BORDER, 0.8)
        rounded(c, x + 12, 334, w - 24, 28, 10, fill)
        text(c, heading, x + 24, 344, 9, accent, "GuideKit-Bold")
        iy = 296
        for title_value, body in items:
            c.setFillColor(accent)
            c.circle(x + 27, iy + 4, 4, fill=1, stroke=0)
            text(c, title_value, x + 41, iy, 12, INK, "GuideKit-Bold")
            text(c, body, x + 41, iy - 21, 9.2, MUTED, max_width=w - 62, leading=12.5)
            iy -= 74

    arrow(c, 282, 235, 360, 235, EMERALD, 2)
    arrow(c, 601, 235, 679, 235, EMERALD, 2)
    text(c, "configure + publish", 321, 250, 8.5, SUBTLE, "GuideKit-Bold", align="center")
    text(c, "answer + action", 640, 250, 8.5, SUBTLE, "GuideKit-Bold", align="center")

    rounded(c, 371, 58, 218, 28, 10, INK)
    text(c, "AI intelligence plane - Gemini models", 389, 68, 9.5, SURFACE, "GuideKit-Bold")
    line(c, 480, 96, 480, 86, INK, 1.4)
    footer(c, 5, "Solution architecture")


def resilience(c: Canvas):
    page_base(c, 6, "Tools and actions")
    title_block(c, "Tool feature", "A useful chatbot should do more than produce text.",
                "GuideKit routes action-oriented requests to tools configured by the company. A tool may open the right product action, launch a guided workflow, or connect to an approved business operation.",
                6, "Tools and actions")

    tiers = [
        ("STEP 1", "Detect intent", "Recognize that the user wants an outcome, not only an explanation.", "Gemini routing", EMERALD),
        ("STEP 2", "Select a tool", "Match the request to an allowed capability and required context.", "Company-defined", BLUE),
        ("STEP 3", "Confirm + invoke", "Collect missing details and require confirmation when the action is sensitive.", "Controlled", AMBER),
        ("STEP 4", "Return the result", "Keep success, failure, and recovery inside the same conversation.", "Observable", INK),
    ]
    y = 315
    for i, (tier, heading, body, tag, accent) in enumerate(tiers):
        x = 52 + i * 218
        rounded(c, x, 105, 194, 220, 17, SURFACE, BORDER, 0.8)
        rounded(c, x + 16, y - 20, 70, 22, 11, accent)
        text(c, tier, x + 28, y - 13, 8.5, SURFACE, "GuideKit-Bold")
        text(c, heading, x + 16, 248, 15, INK, "GuideKit-Bold", max_width=162)
        text(c, body, x + 16, 217, 9.8, MUTED, max_width=162, leading=13)
        rounded(c, x + 16, 124, 96, 23, 11, SOFT)
        text(c, tag, x + 28, 132, 8.5, INK, "GuideKit-Bold")
        if i < 3:
            arrow(c, x + 197, 215, x + 214, 215, EMERALD, 1.2)

    text(c, "Example requests", 52, 74, 11, EMERALD, "GuideKit-Bold")
    text(c, '"Update my plan"  |  "Show me how to export"  |  "Book an appointment"  |  "Open billing settings"', 166, 74, 11.5, INK, "GuideKit-Bold")


def ai_strategy(c: Canvas):
    page_base(c, 7, "AI strategy")
    title_block(c, "How AI is used", "Gemini turns conversation into the right response or capability.",
                "The intended production intelligence layer uses Gemini models for fast intent understanding, grounded answer generation, and controlled tool selection.",
                7, "AI strategy")

    use_cases = [
        ("Intent orchestration", "Classify whether the user needs a knowledge answer, a tool, a guided workflow, small talk, or a safe refusal.", EMERALD),
        ("Grounded RAG answers", "Synthesize a concise response from the most relevant company-owned chunks rather than unsupported model memory.", BLUE),
        ("Tool selection", "Choose only from company-configured capabilities and pass structured context for validation and confirmation.", AMBER),
    ]
    x = 52
    for title_value, body, accent in use_cases:
        card_title(c, title_value, body, x, 189, 267, 144, accent)
        x += 291

    rounded(c, 52, 92, 856, 72, 16, INK)
    text(c, "Grounded by design", 72, 134, 12, MINT, "GuideKit-Bold")
    text(c, "Retrieved evidence  |  allowed-tool list  |  confidence thresholds  |  confirmation gates  |  telemetry  |  safe fallback",
         72, 108, 10.2, SURFACE, "GuideKit-Bold", max_width=790)

    rounded(c, 641, 351, 267, 49, 13, EMERALD_SOFT)
    text(c, "Current build note", 657, 379, 9, EMERALD_DARK, "GuideKit-Bold")
    text(c, "The prototype is provider-configurable and retains Mercury demo wiring while Gemini is the production model direction.",
         657, 361, 8.4, MUTED, max_width=235, leading=11)


def value(c: Canvas):
    page_base(c, 8, "Developer value")
    title_block(c, "Why companies adopt it", "Launch a capable website assistant without building the entire AI stack.",
                "GuideKit packages the difficult parts - chat UX, retrieval, orchestration, tools, guidance, analytics, and recovery - behind one integration.",
                8, "Developer value")

    left = [
        ("Embed with a browser SDK", "Use a project publishable key and approved website origin to mount GuideBot."),
        ("Bring company knowledge", "Upload policies, documentation, FAQs, and product content for project-scoped retrieval."),
        ("Connect meaningful tools", "Expose only the actions the company wants the assistant to offer."),
    ]
    right = [
        ("Unify answers and actions", "The same conversation can move from explanation to tool or guided completion."),
        ("Respect the host application's auth", "GuideKit observes configured signals without becoming the customer's identity provider."),
        ("Measure real demand", "Conversation routes, tool demand, tour usage, and failures create a product feedback loop."),
    ]
    for col, items in enumerate((left, right)):
        x = 52 + col * 438
        y = 318
        for idx, (heading, body) in enumerate(items):
            c.setFillColor(EMERALD if idx == 0 else INK)
            c.circle(x + 8, y + 3, 5, fill=1, stroke=0)
            text(c, heading, x + 24, y, 13, INK, "GuideKit-Bold", max_width=365)
            text(c, body, x + 24, y - 25, 10, MUTED, max_width=360, leading=13)
            y -= 92

    rounded(c, 52, 73, 856, 45, 13, EMERALD_SOFT)
    text(c, "Outcome", 70, 89, 10, EMERALD_DARK, "GuideKit-Bold")
    text(c, "A company gets one configurable assistant; its users get answers and outcomes without leaving the product.", 136, 88, 12, INK, "GuideKit-Bold")


def proof(c: Canvas):
    page_base(c, 9, "Current product proof")
    title_block(c, "What exists today", "A working chatbot and knowledge foundation, with tools as the next product layer.",
                "The repository already contains the core surfaces required for an embedded, grounded website assistant and guided product actions.",
                9, "Current product proof")

    items = [
        ("Embedded GuideBot", "A browser SDK mounts a Shadow DOM chat widget directly inside the customer's website."),
        ("Knowledge ingestion", "Text, markdown, PDFs, and FAQs can be stored, chunked, embedded, and scoped to a project."),
        ("RAG chat routing", "The runtime distinguishes knowledge questions, workflow intents, small talk, and out-of-scope requests."),
        ("Guided actions", "Matched feature intents can launch contextual, multi-step workflows inside the host application."),
        ("Developer console", "Projects, origins, keys, knowledge, workflows, analytics, and healing review are managed centrally."),
        ("Production direction", "Gemini-powered tool selection and company-configured action execution extend the working foundation."),
    ]
    for i, (heading, body) in enumerate(items):
        col = i % 3
        row = i // 3
        x = 52 + col * 291
        y = 225 - row * 129
        rounded(c, x, y, 267, 110, 15, SURFACE, BORDER, 0.8)
        c.setFillColor(EMERALD)
        c.circle(x + 23, y + 80, 7, fill=1, stroke=0)
        c.setStrokeColor(SURFACE)
        c.setLineWidth(1.5)
        c.line(x + 19, y + 80, x + 22, y + 77)
        c.line(x + 22, y + 77, x + 27, y + 84)
        text(c, heading, x + 42, y + 75, 13, INK, "GuideKit-Bold")
        text(c, body, x + 18, y + 48, 9.4, MUTED, max_width=231, leading=12.5)


def close(c: Canvas):
    page_base(c, 10, "Investment thesis", dark=True)
    circle_glow(c, 810, 440, 250, EMERALD, 0.42)
    circle_glow(c, 750, 90, 140, BLUE, 0.20)
    label(c, "Investment thesis", 54, 495, MINT)
    text(c, "Every website can have an assistant.\nGuideKit makes it useful.", 54, 426, 37, SURFACE, "GuideKit-Bold", leading=46)
    text(c, "GuideKit is building the embedded AI layer that lets companies turn their knowledge, product workflows, and approved tools into one conversational experience for every website user.",
         56, 300, 15, HexColor("#D4DDD7"), max_width=560, leading=21)

    rounded(c, 54, 131, 532, 80, 16, Color(1, 1, 1, alpha=0.08), Color(1, 1, 1, alpha=0.15), 0.8)
    text(c, "The wedge", 73, 180, 10, MINT, "GuideKit-Bold")
    text(c, "Grounded website chatbot", 73, 154, 13, SURFACE, "GuideKit-Bold", max_width=225, leading=16)
    line(c, 320, 145, 320, 192, Color(1, 1, 1, alpha=0.13), 0.8)
    text(c, "The expansion", 343, 180, 10, MINT, "GuideKit-Bold")
    text(c, "Tools + guided product actions", 343, 154, 13, SURFACE, "GuideKit-Bold", max_width=220, leading=16)

    rounded(c, 674, 155, 218, 238, 20, HexColor("#F8FAF7"))
    text(c, "Why this matters", 696, 354, 13, EMERALD, "GuideKit-Bold")
    points = [
        "Embedded at the moment of need",
        "Grounded in company knowledge",
        "Tools turn answers into outcomes",
        "Gemini powers intent + orchestration",
        "A working chatbot + RAG foundation",
    ]
    y = 317
    for point in points:
        c.setFillColor(EMERALD)
        c.circle(703, y + 3, 4, fill=1, stroke=0)
        text(c, point, 716, y, 10.5, INK, "GuideKit-Bold", max_width=155)
        y -= 35

    text(c, "GUIDEKIT", 54, 66, 10, MINT, "GuideKit-Bold")
    text(c, "Answer the question. Help complete the task.", 54, 42, 11, HexColor("#AEBBB3"))


def build():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    c = Canvas(str(OUTPUT), pagesize=(PAGE_W, PAGE_H), pageCompression=1)
    c.setTitle("GuideKit Investor Overview")
    c.setAuthor("GuideKit")
    c.setSubject("Embedded AI chatbot with grounded RAG answers, tools, and guided actions")
    for renderer in (cover, problem, solution, journey, architecture, resilience, ai_strategy, value, proof, close):
        renderer(c)
        c.showPage()
    c.save()
    print(OUTPUT)


if __name__ == "__main__":
    build()
