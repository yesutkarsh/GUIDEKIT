<script>
  let phone = "";
  let otp = "";
  let step = 1;

  async function handleSendOtp(e) {
    e.preventDefault();
    if (phone) step = 2;
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    window.location.href = "/book";
  }
</script>

<main class="auth-page">
  <div class="auth-card">
    <h2>Sign In to Taxi Sanchalak</h2>
    <p>Enter your 10-digit mobile number to receive a one-time passcode.</p>

    {#if step === 1}
      <form on:submit={handleSendOtp}>
        <div class="field">
          <label for="phone-input">Mobile Number</label>
          <input
            id="phone-input"
            type="tel"
            bind:value={phone}
            placeholder="9876543210"
            required
           data-guide-id="login-phone-step"/>
        </div>
        <button id="send-otp-btn" type="submit" class="submit-btn" data-guide-id="login-submit-step">Send OTP</button>
      </form>
    {:else}
      <form on:submit={handleVerifyOtp}>
        <div class="field">
          <label for="otp-input">Enter OTP Code</label>
          <input
            id="otp-input"
            type="text"
            bind:value={otp}
            placeholder="1234"
            required
          />
        </div>
        <button id="login-submit-btn" type="submit" class="submit-btn">Sign In</button>
      </form>
    {/if}
  </div>
</main>

<style>
  .auth-page { display: flex; justify-content: center; align-items: center; min-height: 80vh; font-family: sans-serif; }
  .auth-card { background: #121316; border: 1px solid #1f2229; padding: 32px; border-radius: 12px; width: 360px; color: #fff; }
  .field { margin-bottom: 16px; display: flex; flexDirection: column; }
  input { padding: 10px; border-radius: 6px; border: 1px solid #2d3240; background: #0a0a0c; color: #fff; }
  .submit-btn { width: 100%; padding: 10px; background: #10b981; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; }
</style>
