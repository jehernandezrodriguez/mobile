import React, { PureComponent } from "react";
import PropTypes from "prop-types";
import { Vibration, Platform, Alert, BackHandler, UIManager } from "react-native";
import { NavigationActions } from "react-navigation";
import { connect } from "react-redux";
import { Notifications } from 'expo';
import * as Permissions from 'expo-permissions';
import Constants from 'expo-constants';

import { AppNavigator } from "../navigators/AppNavigator";
import { HOME_ROUTE_NAME, SIGN_IN_ROUTE_NAME } from "../navigators/routeNames";
import getRouteName from "../navigators/getRouteName";
// import Logger from "../models/Logger";


class AppWithNavigationState extends PureComponent {
  componentDidMount() {
    this.registerForPushNotificationsAsync();

    if (UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }

    BackHandler.addEventListener("hardwareBackPress", this.onBackPress);

    this.notificationSubscription = Notifications.addListener(this.handleNotification);
  }

  componentWillUnmount() {
    BackHandler.removeEventListener("hardwareBackPress", this.onBackPress);
  }

  registerForPushNotificationsAsync = async () => {
    if (Constants.isDevice) {
      const { status: existingStatus } = await Permissions.getAsync(Permissions.NOTIFICATIONS);
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Permissions.askAsync(Permissions.NOTIFICATIONS);
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        Alert.alert(
          "Error",
          "No se puede obtener token para recibir notificaciones. Es posible que necesite reiniciar la aplicación.",
          [{ text: "OK" }]
        );
        return;
      }

    }

    if (Platform.OS === 'android') {
      Notifications.createChannelAndroidAsync('default', {
        name: 'default',
        sound: true,
        priority: 'max',
        vibrate: [0, 250, 250, 250],
      });
    }
  };

  handleNotification = notification => {
    if (notification)
      Vibration.vibrate();
  };

  onBackPress = () => {
    const { dispatch, navigation } = this.props;
    const { routeName } = getRouteName({ navigation });
    if (routeName === HOME_ROUTE_NAME || routeName === SIGN_IN_ROUTE_NAME) {
      return false;
    }
    dispatch(NavigationActions.back());
    return true;
  };

  render() {
    // console.log(`AppWithNavigationState: render`);
    const { addListener, dispatch, navigation } = this.props;

    return (
      <AppNavigator
        navigation={{
          dispatch,
          state: navigation,
          addListener,
        }}
      />
    );
  }
}

AppWithNavigationState.propTypes = {
  dispatch: PropTypes.func.isRequired,
  navigation: PropTypes.shape({
    index: PropTypes.number.isRequired,
    routes: PropTypes.arrayOf(
      PropTypes.shape({
        routeName: PropTypes.string.isRequired,
        key: PropTypes.string,
      })
    ).isRequired,
  }).isRequired,
  addListener: PropTypes.func.isRequired,
};

const mapStateToProps = state => ({
  navigation: state.navigation,
});

export default connect(mapStateToProps)(AppWithNavigationState);
