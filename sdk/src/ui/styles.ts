/** Host-page spotlight styles. The chatbot itself is built from Tailwind utilities in widgetElement.ts. */

export const SPOTLIGHT_STYLES = `
  #guidekit-spotlight-root {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 2147483600;
    transition: opacity 0.2s ease;
  }

  .guidekit-spotlight-svg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .guidekit-spotlight-card {
    position: absolute;
    pointer-events: auto;
    background: #0D0E12;
    border: 1px solid #232631;
    border-radius: 12px;
    padding: 16px;
    width: 320px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05);
    color: #F3F4F6;
    font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 13px;
    line-height: 1.5;
    z-index: 2147483605;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .guidekit-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .guidekit-step-badge {
    font-size: 11px;
    font-weight: 700;
    color: #10B981;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .guidekit-tier-badge {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 600;
  }
  .tier-primary { background: rgba(16, 185, 129, 0.15); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.3); }
  .tier-fingerprint { background: rgba(59, 130, 246, 0.15); color: #60A5FA; border: 1px solid rgba(59, 130, 246, 0.3); }
  .tier-ai { background: rgba(245, 158, 11, 0.15); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.3); }
  .tier-cache { background: rgba(168, 85, 247, 0.15); color: #C084FC; border: 1px solid rgba(168, 85, 247, 0.3); }

  .guidekit-card-title {
    font-size: 15px;
    font-weight: 700;
    color: #FFFFFF;
    margin: 4px 0 6px 0;
  }

  .guidekit-card-desc {
    color: #9CA3AF;
    font-size: 12px;
    margin-bottom: 14px;
  }

  .guidekit-card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-top: 1px solid #1C1E26;
    padding-top: 10px;
    margin-top: 6px;
  }

  .guidekit-btn-group {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .guidekit-btn {
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.15s ease;
  }

  .guidekit-btn-next { background: #10B981; color: #0A0A0C; }
  .guidekit-btn-next:hover { background: #059669; }
  .guidekit-btn-prev { background: #1A1C23; color: #D1D5DB; border-color: #282C37; }
  .guidekit-btn-prev:hover { background: #222530; }
  .guidekit-btn-close { background: transparent; color: #9CA3AF; padding: 4px 8px; }
  .guidekit-btn-close:hover { color: #FFFFFF; }
  .guidekit-btn-tts { background: #1A1C23; color: #FBBF24; border: 1px solid #282C37; padding: 5px 8px; }
`;
