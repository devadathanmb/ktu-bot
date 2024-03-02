import { axios } from "@/config/axiosConfig";

// eg : [[{"label":"LABEL_1","score":0.9968029260635376},{"label":"LABEL_0","score":0.0031970764975994825}]]
interface Relevancy {
  label: string;
  score: number;
}

async function getRelevancy(inputText: string): Promise<boolean> {
  try {
    const payload = {
      inputs: inputText,
      options: {
        // If the model is not already loaded, wait for it to load
        // If this is not set, we get a immediate response with the model not loaded error
        wait_for_model: true,
      },
    };

    const headers = {
      Authorization: process.env.HUGGING_FACE_TOKEN,
    };

    const INFERENCER_URL =
      "https://api-inference.huggingface.co/models/devadathanmb/ktu-notifs-relevancy-bert";
    const response = await axios.post(INFERENCER_URL, payload, {
      headers: headers,
    });

    const relevantData: Relevancy[] = response.data[0];
    const relevancyLabel = Number(relevantData[0].label.split("_")[1]);
    if (relevancyLabel === 1) {
      return true;
    }
    return false;
  } catch (error: any) {
    console.log(error);
    // In any case this fails, it is always best to assume the notification is relevant
    return true;
  }
}

export default getRelevancy;
