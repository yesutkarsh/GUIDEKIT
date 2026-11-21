
    console.log(JSON.stringify({ type: "tool_call", tool: "glob", args: { pattern: "**/*.svelte" } }));
    console.log(JSON.stringify({ type: "reasoning", thinking: "Analyzing interactive elements in routes/driver" }));
    setTimeout(() => {
      console.log('<<<GUIDEKIT_FLOW_JSON_START>>>');
      console.log(JSON.stringify({"slug":"ask-money-on-the-go","content":{"en":{"title":"Ask for Money on the Go","description":"Withdraw driver earnings on demand."}},"example_queries":["How do I ask for money?"],"requires_auth":true,"required_role":"driver","prerequisite_feature_slug":"login","steps":[{"step_order":1,"guide_id":"driver-payout-cta-step","route_pattern":"/driver/dashboard","action_type":"click","advance_on":"click","content":{"en":{"title":"Instant Cash Out","description":"Click to withdraw funds."}},"target_fingerprint":{"tag":"button","css":"button#instant-payout-cta","attrs":{"id":"instant-payout-cta"}}}]}));
      console.log('<<<GUIDEKIT_FLOW_JSON_END>>>');
    }, 200);
  