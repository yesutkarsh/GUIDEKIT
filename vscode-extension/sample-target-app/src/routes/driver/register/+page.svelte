<script>
  let licenseNumber = "";
  let plateNumber = "";
  let submitted = false;

  function handleRegister(e) {
    e.preventDefault();
    submitted = true;
  }
</script>

<main class="onboarding-page">
  <div class="onboarding-card">
    <h1>Become a Driver Partner</h1>
    <p>Earn daily payouts, flexible shifts, and full insurance coverage.</p>

    {#if submitted}
      <div class="verified-box">
        <h3>Application Submitted</h3>
        <p>Your documents are under fast-track verification. Expected turnaround: 2 hours.</p>
      </div>
    {:else}
      <form on:submit={handleRegister}>
        <div class="field">
          <label for="license-number">Commercial Driving License (DL)</label>
          <input
            id="license-number"
            type="text"
            bind:value={licenseNumber}
            placeholder="DL-0420110012345"
            required
           data-guide-id="driver-reg-license-step"/>
        </div>

        <div class="field">
          <label for="plate-number">Vehicle Registration Number</label>
          <input
            id="plate-number"
            type="text"
            bind:value={plateNumber}
            placeholder="DL-01-AB-1234"
            required
           data-guide-id="driver-reg-plate-step"/>
        </div>

        <button
          type="submit"
          id="driver-register-btn"
          class="submit-partner-btn"
         data-guide-id="driver-reg-submit-step">
          Submit Driver Registration
        </button>
      </form>
    {/if}
  </div>
</main>

<style>
  .onboarding-page { max-width: 520px; margin: 40px auto; font-family: sans-serif; color: #fff; }
  .onboarding-card { background: #121316; border: 1px solid #1f2229; padding: 28px; border-radius: 12px; }
  .field { margin-bottom: 16px; display: flex; flex-direction: column; }
  input { padding: 10px; border-radius: 6px; border: 1px solid #2d3240; background: #0a0a0c; color: #fff; margin-top: 6px; }
  .submit-partner-btn { width: 100%; padding: 12px; background: #10b981; color: #0a0a0c; font-weight: bold; border: none; border-radius: 6px; cursor: pointer; }
  .verified-box { background: rgba(16, 185, 129, 0.1); border: 1px solid #10b981; padding: 16px; border-radius: 8px; text-align: center; }
</style>
