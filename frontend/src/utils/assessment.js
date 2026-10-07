export function getRecommendationExplanation(result) {
  if (result?.accuracy === 100) {
    return "Your diagnostic showed strong understanding across the assessed questions. ADAPT will adjust the starting point using your practice results.";
  }
  return result?.explanation || "ADAPT will refine this recommendation as it learns from your practice.";
}
