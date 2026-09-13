export const STT_MODELS = {
  mistral: [{ value: "voxtral-mini-latest", label: "Voxtral Mini" }],
  deepgram: [{ value: "flux-general-multi", label: "Flux Multilingual" }],
} as const;

export const TTS_MODELS = {
  mistral: [{ value: "voxtral-mini-tts-latest", label: "Voxtral Mini TTS" }],
  cartesia: [{ value: "sonic-3.6", label: "Sonic 3.6" }],
} as const;

export const VOICES = {
  mistral: [
    { value: "en_paul_neutral", label: "Paul — English" },
    { value: "gb_jane_neutral", label: "Jane — British English" },
    { value: "gb_oliver_neutral", label: "Oliver — British English" },
    { value: "fr_marie_neutral", label: "Marie — French" },
  ],
  cartesia: [
    {
      value: "9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
      label: "Jacqueline — English",
    },
    {
      value: "9b4d08b6-0494-4301-ab92-9150f4ee2718",
      label: "Marlene — German",
    },
    {
      value: "7a62541e-5492-410e-95ff-3abd096fce87",
      label: "Natalia — Russian",
    },
    {
      value: "1e4176b1-3db9-44d6-a601-4fe68b041942",
      label: "Sergei — Russian",
    },
  ],
} as const;

export const DEFAULT_CARTESIA_VOICE = VOICES.cartesia[0].value;
