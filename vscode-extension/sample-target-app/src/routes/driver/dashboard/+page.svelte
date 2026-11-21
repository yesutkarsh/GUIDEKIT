<script>
  import { onMount } from "svelte";

  let user = { role: "driver", name: "Ramesh Kumar" };
  let currentEarnings = 3450;
  let payoutAmount = 2500;
  let selectedPlan = "daily-pro";
  let payoutRequested = false;
  let subActivated = false;

  onMount(() => {
    // Role guard: only authenticated drivers can access
    const role = localStorage.getItem("user_role") || "driver";
    if (role !== "driver") {
      window.location.href = "/login";
    }
  });

  function handlePayout(e) {
    e.preventDefault();
    payoutRequested = true;
    currentEarnings -= payoutAmount;
  }

  function handleSubscription(e) {
    e.preventDefault();
    subActivated = true;
  }
</script>

<main class="dashboard-page">
  <header class="dash-header">
    <h1>Driver Command Center</h1>
    <div class="driver-profile">
      <span>{user.name}</span>
      <span class="role-badge">Verified Driver</span>
    </div>
  </header>

  <div class="metrics-grid">
    <div class="metric-card">
      <span class="metric-label">Today's Available Cash</span>
      <span class="metric-value">₹{currentEarnings}</span>
    </div>
  </div>

  <div class="flows-grid">
    <!-- Flow 1: Ask for Money on the Go -->
    <section class="panel-card" id="instant-payout-panel">
      <h2>Ask for Money on the Go</h2>
      <p>Request instant payouts directly to your linked UPI / Bank account.</p>

      {#if payoutRequested}
        <div class="payout-success">
          <strong>₹{payoutAmount} Transferred!</strong>
          <p>UTR Reference: TAXI982341209</p>
        </div>
      {:else}
        <form on:submit={handlePayout}>
          <div class="field">
            <label for="payout-amount">Payout Amount (₹)</label>
            <input
              id="payout-amount"
              type="number"
              bind:value={payoutAmount}
              min="100"
              max={currentEarnings}
              required
             data-guide-id="driver-payout-amount-step"/>
          </div>

          <button
            type="submit"
            id="instant-payout-cta"
            data-testid="instant-payout-cta"
            class="action-btn emerald"
           data-guide-id="driver-payout-cta-step">
            Request Instant Cash
          </button>
        </form>
      {/if}
    </section>

    <!-- Flow 2: Manage Driver Subscription -->
    <section class="panel-card" id="subscription-panel">
      <h2>Manage Driver Subscription</h2>
      <p>Zero-commission prepaid plans for city drivers.</p>

      {#if subActivated}
        <div class="sub-active">
          <strong>Subscription Active!</strong>
          <p>Unlimited zero-commission rides active until midnight.</p>
        </div>
      {:else}
        <form on:submit={handleSubscription}>
          <div class="field">
            <label for="sub-plan">Select Subscription Tier</label>
            <select id="sub-plan" bind:value={selectedPlan} data-guide-id="driver-sub-tier-step">
              <option value="daily-pro">Daily Unlimited — ₹99 / 24 hrs</option>
              <option value="weekly-prime">Weekly Prime — ₹599 / 7 days</option>
              <option value="monthly-max">Monthly Max — ₹1999 / 30 days</option>
            </select>
          </div>

          <button
            type="submit"
            id="activate-sub-btn"
            class="action-btn blue"
           data-guide-id="driver-sub-activate-step">
            Activate Subscription
          </button>
        </form>
      {/if}
    </section>
  </div>
</main>

<style>
  .dashboard-page { max-width: 900px; margin: 30px auto; font-family: sans-serif; color: #fff; padding: 0 16px; }
  .dash-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1f2229; padding-bottom: 16px; }
  .role-badge { background: #10b981; color: #0a0a0c; font-size: 11px; padding: 3px 8px; border-radius: 4px; font-weight: bold; margin-left: 8px; }
  .metrics-grid { margin: 24px 0; }
  .metric-card { background: #121316; border: 1px solid #1f2229; border-radius: 10px; padding: 20px; width: 220px; }
  .metric-label { font-size: 12px; color: #8e929f; display: block; }
  .metric-value { font-size: 28px; font-weight: bold; color: #10b981; margin-top: 4px; display: block; }
  .flows-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .panel-card { background: #121316; border: 1px solid #1f2229; border-radius: 12px; padding: 24px; }
  .field { margin-bottom: 16px; display: flex; flex-direction: column; }
  input, select { padding: 10px; border-radius: 6px; border: 1px solid #2d3240; background: #0a0a0c; color: #fff; margin-top: 6px; }
  .action-btn { width: 100%; padding: 12px; font-weight: bold; border: none; border-radius: 6px; cursor: pointer; }
  .emerald { background: #10b981; color: #0a0a0c; }
  .blue { background: #3b82f6; color: #ffffff; }
  .payout-success, .sub-active { background: rgba(16, 185, 129, 0.1); border: 1px solid #10b981; padding: 16px; border-radius: 8px; }
</style>
