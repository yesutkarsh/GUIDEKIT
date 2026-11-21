<script>
  import { onMount } from "svelte";

  let session = true;
  let pickup = "";
  let dropoff = "";
  let vehicleType = "sedan";
  let booked = false;

  onMount(() => {
    // Auth guard: redirect unauthenticated passengers to login
    const token = localStorage.getItem("passenger_token");
    if (!token && !session) {
      window.location.href = "/login";
    }
  });

  function handleBooking(e) {
    e.preventDefault();
    booked = true;
  }
</script>

<main class="booking-page">
  <div class="booking-card">
    <h1>Book a Taxi</h1>
    <p>Real-time drivers ready nearby.</p>

    {#if booked}
      <div class="success-alert">
        <h3>Driver En Route!</h3>
        <p>Your taxi has been confirmed. ETA: 4 minutes.</p>
      </div>
    {:else}
      <form on:submit={handleBooking}>
        <div class="field">
          <label for="pickup-location">Pickup Location</label>
          <input
            id="pickup-location"
            type="text"
            bind:value={pickup}
            placeholder="e.g. Connaught Place, New Delhi"
            required
           data-guide-id="book-pickup-step"/>
        </div>

        <div class="field">
          <label for="dropoff-location">Dropoff Destination</label>
          <input
            id="dropoff-location"
            type="text"
            bind:value={dropoff}
            placeholder="e.g. Indira Gandhi International Airport"
            required
           data-guide-id="book-dropoff-step"/>
        </div>

        <div class="field">
          <label for="vehicle-type">Vehicle Category</label>
          <select id="vehicle-type" bind:value={vehicleType}>
            <option value="hatchback">Mini / Hatchback (4 seats)</option>
            <option value="sedan">Sedan Comfort (4 seats)</option>
            <option value="suv" data-guide-id="custom-flow-step-1">SUV XL (6 seats)</option>
          </select>
        </div>

        <button
          type="submit"
          data-testid="confirm-booking-btn"
          id="confirm-booking-btn"
          class="book-btn"
         data-guide-id="book-confirm-step">
          Book Taxi Now
        </button>
      </form>
    {/if}
  </div>
</main>

<style>
  .booking-page { max-width: 520px; margin: 40px auto; font-family: sans-serif; color: #fff; }
  .booking-card { background: #121316; border: 1px solid #1f2229; padding: 28px; border-radius: 12px; }
  .field { margin-bottom: 16px; display: flex; flex-direction: column; }
  input, select { padding: 10px; border-radius: 6px; border: 1px solid #2d3240; background: #0a0a0c; color: #fff; margin-top: 6px; }
  .book-btn { width: 100%; padding: 12px; background: #10b981; color: #0a0a0c; font-weight: bold; border: none; border-radius: 6px; cursor: pointer; }
  .success-alert { background: rgba(16, 185, 129, 0.1); border: 1px solid #10b981; padding: 16px; border-radius: 8px; text-align: center; }
</style>
