// Example usage of the LLM service
import { LLMService } from "../src/api/services/index.js";

async function testLLMService() {
  const llmService = new LLMService();

  // Test with a relevant notification
  const relevantNotification =
    "Semester exam results are now available. Students can check their results on the official KTU portal.";
  const relevantResult =
    await llmService.isAnnouncementRelevant(relevantNotification);
  console.log("Relevant notification result:", relevantResult);

  // Test with an irrelevant notification
  const irrelevantNotification =
    " Online Interactive Session on Fulbright Fellowships";
  const irrelevantResult = await llmService.isAnnouncementRelevant(
    irrelevantNotification
  );
  console.log("Irrelevant notification result:", irrelevantResult);
}

// Uncomment to test
testLLMService();
