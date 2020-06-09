import { differenceInMilliseconds } from "date-fns";
import { Alert } from "react-native";

class AlertManager {
  alertTitleDiscard = "¿Descartar?";
  alertTitleDelete = "¿Eliminar?";
  alertTitleOffline = "No hay conexión de internet!";
  alertTitleUnknownError = "Se produjo un error desconocido";
  alertButtonTextCancel = "Cancelar";
  alertButtonTextDiscard = "Descartar";
  alertButtonTextDelete = "Eliminar";
  alertButtonTextSave = "Guardar";

  showDiscardOrSaveAlert({ message, onPressDiscard, onPressSave }) {
    Alert.alert("Save?", message, [
      {
        text: this.alertButtonTextDiscard,
        onPress: onPressDiscard,
        style: "destructive",
      },
      {
        text: this.alertButtonTextSave,
        onPress: onPressSave,
      },
    ]);
  }

  showCancelOrDestructiveAlert({
    title,
    message,
    destructiveButtonText,
    onPress,
  }) {
    Alert.alert(title, message, [
      {
        text: this.alertButtonTextCancel,
        style: "cancel",
      },
      {
        text: destructiveButtonText,
        onPress,
        style: "destructive",
      },
    ]);
  }

  showOfflineMessage(message) {
    Alert.alert(this.alertTitleOffline, message, [{ text: "OK" }]);
  }

  showError(errorMessage) {
    const showErrorTime = new Date();

    if (
      !this.lastShowErrorTime ||
      Math.abs(
        differenceInMilliseconds(this.lastShowErrorTime, showErrorTime)
      ) > 500
    ) {
      if (errorMessage === "Network Error") {
        Alert.alert(
          this.alertTitleOffline,
          `Parece que estás desconectado, por lo que tus notas no se pueden cargar ni guardar.`,
          [{ text: "OK" }]
        );
      } else {
        Alert.alert(
          this.alertTitleUnknownError,
          `Un error desconocido ocurrió. Estamos trabajando para resolver este problema.`,
          [{ text: "OK" }]
        );
      }
    } else {
      // console.log(
      //   `Skipping error message since sent too quickly after previous one: ${errorMessage}`
      // );
    }

    this.lastShowErrorTime = showErrorTime;
  }
}

export default new AlertManager();
