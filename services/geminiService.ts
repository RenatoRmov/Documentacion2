
import { GoogleGenAI, Type } from "@google/genai";
import { Vehicle } from "../types";

export const askGemini = async (query: string, fleet: Vehicle[]) => {
  // Always use a named parameter for apiKey and use process.env.API_KEY directly.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const fleetContext = fleet.map(v => ({
    movil: v.id,
    patente: v.patente,
    conductor: v.nombreConductor,
    marca: v.marca,
    modelo: v.modelo,
    vencimientos: {
      rt: v.vencimientoRevisionTecnica,
      pc: v.vencimientoPermisoCirculacion,
      soap: v.vencimientoSOAP,
      // Fixed: Property 'vencimientoLicencia' does not exist on type 'Vehicle'. Using 'vigenciaLicenciaHasta' instead.
      licencia: v.vigenciaLicenciaHasta
    }
  }));

  const systemInstruction = `
    Eres un asistente experto para RadioMovil, una empresa de taxis.
    Tienes acceso a la lista actual de la flota. 
    Tu objetivo es ayudar al usuario (el dueño, un señor mayor) a encontrar información rápidamente.
    Sé profesional, conciso y amable.
    Si te preguntan por documentos vencidos, enuméralos claramente indicando el Móvil y la Patente.
    Hoy es ${new Date().toLocaleDateString()}.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Contexto de la flota: ${JSON.stringify(fleetContext)}\n\nPregunta del usuario: ${query}`,
      config: {
        systemInstruction,
        temperature: 0.2,
      },
    });

    // Access .text property directly, not as a method.
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Lo siento, tuve un problema analizando la flota. ¿Puedes intentar de nuevo?";
  }
};
