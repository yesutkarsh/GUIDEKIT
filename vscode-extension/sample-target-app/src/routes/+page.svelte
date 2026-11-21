<script>
  let companyName = "Taxi Sanchalak";
</script>

<svelte:head>
  <title>{companyName} — Real-time Taxi & Cab Network</title>
</svelte:head>

<main class="hero-container">
  <header class="navbar">
    <div class="logo">{companyName}</div>
    <nav>
      <a href="/login" class="nav-link" id="nav-login-btn">Driver Sign In</a>
    </nav>
  </header>

  <section class="hero-content">
    <h1>Reliable Rides Across India</h1>
    <p>Book local city taxis, outstation cabs, and express airport transfers in seconds.</p>

    <div class="action-buttons">
      <a href="/book" class="cta-btn primary" id="home-book-ride-cta">Book a Taxi</a>
      <a href="/driver/register" class="cta-btn secondary" id="home-become-driver-cta">Become a Driver</a>
    </div>
  </section>
</main>

<style>
  .hero-container { font-family: sans-serif; padding: 24px; }
  .navbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 48px; }
  .logo { font-size: 20px; font-weight: bold; color: #10b981; }
  .cta-btn { display: inline-block; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-right: 12px; }
  .primary { background: #10b981; color: #0a0a0c; }
  .secondary { background: #1f2229; color: #ffffff; }
</style>

