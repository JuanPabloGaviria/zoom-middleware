/**
 * Simple sleep function
 * @param ms - Time to sleep in milliseconds
 */
export const sleep = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
  };
  
  /**
   * Predefined transcription for test audio (for when API fails)
   */
  export const getTestAudioTranscription = (): string => {
    return "Hola equipo, vamos a revisar algunos cambios para nuestros personajes. Para el Project: Prj, necesitamos actualizar al Character: Jerry con una nueva Task: Blocking para la cabeza y el cuerpo. El movimiento no es fluido y necesitamos mejorar las expresiones faciales. También para Character: Tom necesitamos revisar la Task: Animation de las patas traseras. No olvidemos actualizar la documentación en ClickUp con estos cambios.";
  };