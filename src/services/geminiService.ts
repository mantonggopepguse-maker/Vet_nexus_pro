import { ScannedProductData } from "../types";
import { api } from "./apiService";

/**
 * Sends a product image to the backend AI service to extract inventory details.
 */
export const analyzeProductImage = async (base64Image: string): Promise<ScannedProductData> => {
  try {
    // We now use the backend API to handle AI analysis for better reliability and security
    const result = await api.ai.scanProduct(base64Image);
    return result as ScannedProductData;
  } catch (error: any) {
    console.error("Error analyzing product image via backend:", error);

    // Extract detailed error message if available
    const errorMessage = error.message || "Failed to scan product";

    // Provide user-friendly error messages
    if (errorMessage.includes('AI configuration missing')) {
      throw new Error("AI service is not configured. Please contact support.");
    } else if (errorMessage.includes('Network error')) {
      throw new Error("Unable to connect to AI service. Please check your internet connection and try again.");
    } else if (errorMessage.includes('model not available')) {
      throw new Error("AI service is temporarily unavailable. Please try again later.");
    }

    throw new Error("Failed to scan product. Please try again or enter details manually.");
  }
};

/**
 * Suggests potential diagnoses based on clinical signs using backend AI service.
 */
export const suggestDiagnosis = async (complaint: string, assessment: string): Promise<Array<{ diagnosis: string; confidence: number }>> => {
  try {
    const suggestions = await api.ai.suggestDiagnosis(complaint, assessment);
    return suggestions;
  } catch (error: any) {
    console.error("Diagnosis suggestion failed via backend:", error);

    // Log but don't throw - gracefully degrade to empty suggestions
    const errorMessage = error.message || "Unknown error";
    if (errorMessage.includes('AI configuration missing')) {
      console.warn("AI service not configured");
    } else if (errorMessage.includes('Network error')) {
      console.warn("Network error connecting to AI service");
    }

    return [];
  }
};