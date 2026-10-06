"use client";
import { createContext, useContext } from "react";
export type WidgetLanguage = "en" | "de";
export const WidgetLanguageContext = createContext<WidgetLanguage>("en");
const german: Record<string, string> = {
  "Connecting to agent": "Verbindung zum Assistenten wird hergestellt",
  Reconnecting: "Verbindung wird wiederhergestellt",
  "Conversation ended": "Gespräch beendet",
  "Connection error": "Verbindungsfehler",
  "Agent is responding": "Assistent antwortet",
  "Processing your request": "Deine Anfrage wird bearbeitet",
  "Ready for your message": "Bereit für deine Nachricht",
  "Share conversation": "Gespräch teilen",
  "Close side panel": "Seitenleiste schließen",
  "Open side panel": "Seitenleiste öffnen",
  "Save draft and close conversation":
    "Entwurf speichern und Gespräch schließen",
  "Close conversation": "Gespräch schließen",
  "Conversation messages": "Nachrichten",
  "Connecting to your agent": "Verbindung zum Assistenten wird hergestellt",
  "Start a conversation": "Gespräch starten",
  You: "Du",
  Message: "Nachricht",
  "Message your agent · Enter to send":
    "Nachricht schreiben · Enter zum Senden",
  "Sending message": "Nachricht wird gesendet",
  "Please save the form before continuing.":
    "Bitte speichere das Formular, bevor du fortfährst.",
  "End call": "Anruf beenden",
  "Start call": "Anruf starten",
  "Your microphone level": "Dein Mikrofonpegel",
  "Ending call…": "Anruf wird beendet…",
  "Calling…": "Anruf wird gestartet…",
  "Call disconnected": "Verbindung unterbrochen",
  "Reconnecting…": "Verbindung wird wiederhergestellt…",
  "On the line": "Verbunden",
  "Connecting call…": "Anruf wird verbunden…",
  "Call duration": "Anrufdauer",
  Connecting: "Verbindung wird hergestellt",
  Listening: "Ich höre zu",
  "You are speaking": "Du sprichst",
  Processing: "Wird verarbeitet",
  Speaking: "Assistent spricht",
  "Microphone off": "Mikrofon ausgeschaltet",
  "AI assistant": "KI-Assistent",
};
export function useWidgetText() {
  const language = useContext(WidgetLanguageContext);
  return (text: string) => (language === "de" ? german[text] || text : text);
}
