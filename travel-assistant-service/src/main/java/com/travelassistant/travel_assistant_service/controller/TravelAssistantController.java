package com.travelassistant.travel_assistant_service.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.travelassistant.travel_assistant_service.client.CatalogueClient;
import dev.langchain4j.model.chat.ChatModel;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/assistant")
public class TravelAssistantController {

    private static final int MAX_RECOMMENDATIONS = 3;
    private static final String DEFAULT_SUMMARY = "Here are the trips from our catalogue that best match your request.";

    /** One catalogue package the assistant recommends, with a short reason written for the customer. */
    public record Recommendation(long packageId, String name, String destination, String reason) {}

    /**
     * {@code response} is always present: a short conversational summary when the model answered in the
     * requested JSON shape, otherwise the model's plain-text answer. {@code recommendations} only ever
     * contains packages that exist in the catalogue.
     */
    public record AssistantResponse(String response, List<Recommendation> recommendations) {}

    private final ChatModel chatModel;
    private final CatalogueClient catalogueClient;
    private final ObjectMapper mapper = new ObjectMapper();

    public TravelAssistantController(
            ChatModel chatModel,
            CatalogueClient catalogueClient) {

        this.chatModel = chatModel;
        this.catalogueClient = catalogueClient;
    }

    @PostMapping("/recommend")
    public AssistantResponse recommend(@RequestBody Map<String, String> request) {

        String message = request.get("message");

        String catalogueData = catalogueClient.getAllPackages();

        String prompt = """
                You are the travel concierge for Voyage, a travel booking system. You speak like a warm,
                knowledgeable human concierge.

                The customer has made the following request:

                %s

                Below are the travel packages currently available in our catalogue, as JSON:

                %s

                Choose the packages from the catalogue that best match the request, best first, at most %d.
                Consider destination, budget, travel dates, number of travellers and preferences.

                Respond with ONLY a JSON object in exactly this shape. No markdown, no code fences, no text
                outside the JSON:
                {"summary": "<one or two friendly sentences that respond to the customer's request and introduce your picks, without naming packages or IDs>",
                 "recommendations": [{"packageId": <packageId number copied from the catalogue>, "reason": "<one sentence of at most 30 words on why this package fits the request>"}]}

                Rules:
                - Only use packageId values that appear in the catalogue data. Never invent travel packages.
                - If no package is suitable, return an empty recommendations array and say so briefly in the summary.
                - Use plain text inside the strings, with no markdown formatting.
                """.formatted(message, catalogueData, MAX_RECOMMENDATIONS);

        String answer = chatModel.chat(prompt);

        return toResponse(answer, catalogueData);
    }

    private AssistantResponse toResponse(String answer, String catalogueData) {
        String text = answer == null ? "" : answer.trim();
        try {
            JsonNode root = mapper.readTree(stripCodeFences(text));
            if (root == null || !root.isObject()) {
                return new AssistantResponse(text, List.of());
            }
            Map<Long, JsonNode> catalogue = indexCatalogue(catalogueData);
            List<Recommendation> recommendations = new ArrayList<>();
            for (JsonNode node : root.path("recommendations")) {
                if (!node.path("packageId").canConvertToLong()) continue;
                long packageId = node.path("packageId").asLong();
                JsonNode pkg = catalogue.get(packageId);
                if (pkg == null && !catalogue.isEmpty()) continue; // the model named a package we do not sell
                JsonNode details = pkg != null ? pkg : node;
                recommendations.add(new Recommendation(
                        packageId,
                        details.path("name").asText(null),
                        details.path("destination").asText(null),
                        node.path("reason").asText("").trim()));
                if (recommendations.size() == MAX_RECOMMENDATIONS) break;
            }
            String summary = root.path("summary").asText("").trim();
            if (summary.isEmpty()) {
                summary = recommendations.isEmpty() ? text : DEFAULT_SUMMARY;
            }
            return new AssistantResponse(summary, recommendations);
        } catch (Exception notJson) {
            return new AssistantResponse(text, List.of());
        }
    }

    private Map<Long, JsonNode> indexCatalogue(String catalogueData) {
        Map<Long, JsonNode> byId = new HashMap<>();
        try {
            for (JsonNode pkg : mapper.readTree(catalogueData)) {
                if (pkg.path("packageId").canConvertToLong()) byId.put(pkg.path("packageId").asLong(), pkg);
            }
        } catch (Exception ignored) {
            // Unparseable catalogue data: fall back to trusting the model's package IDs.
        }
        return byId;
    }

    private static String stripCodeFences(String text) {
        String trimmed = text.trim();
        if (trimmed.startsWith("```")) {
            int firstLineEnd = trimmed.indexOf('\n');
            trimmed = firstLineEnd < 0 ? "" : trimmed.substring(firstLineEnd + 1);
            int closing = trimmed.lastIndexOf("```");
            if (closing >= 0) trimmed = trimmed.substring(0, closing);
        }
        return trimmed.trim();
    }
}
