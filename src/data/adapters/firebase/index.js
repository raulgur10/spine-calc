// Adaptador de Firebase. Todo lo que sabe de Firestore, Storage y Firebase Auth
// vive bajo este directorio; nada de aquí se filtra a la interfaz.
export { firebaseEnabled as available } from "../../../firebase";
export * from "./session";
export * from "./casos";
export * from "./telemetry";
