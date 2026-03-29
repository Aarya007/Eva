/** Sample metrics for development when VITE_USE_MOCK_DASHBOARD is true — not real health data. */
export function getMockGreeting() {
  return { name: "Sample user", label: "Sample data" };
}

export function getMockMetrics() {
  return [
    { title: "Weight trend", value: "—", hint: "preview" },
    { title: "Weekly calories", value: "—", hint: "preview" },
  ];
}
