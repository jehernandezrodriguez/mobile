import { AsyncStorage, NativeModules } from "react-native";
import { Notifications } from 'expo';
import * as Permissions from 'expo-permissions';

import { currentProfileRestoreAsync } from "./currentProfile";
import { navigateHome, navigateSignIn } from "./navigation";
import ConnectionStatus from "../models/ConnectionStatus";
import api from "../api";
import Logger from "../models/Logger";
import Metrics from "../models/Metrics";

const AUTH_SIGN_IN_RESET = "AUTH_SIGN_IN_RESET";
const AUTH_SIGN_IN_DID_START = "AUTH_SIGN_IN_DID_START";
const AUTH_SIGN_IN_DID_SUCCEED = "AUTH_SIGN_IN_DID_SUCCEED";
const AUTH_SIGN_IN_DID_FAIL = "AUTH_SIGN_IN_DID_FAIL";
const AUTH_REFRESH_SESSION_TOKEN_DID_START =
  "AUTH_REFRESH_SESSION_TOKEN_DID_START";
const AUTH_REFRESH_SESSION_TOKEN_DID_SUCCEED =
  "AUTH_REFRESH_SESSION_TOKEN_DID_SUCCEED";
const AUTH_REFRESH_SESSION_TOKEN_DID_FAIL =
  "AUTH_REFRESH_SESSION_TOKEN_DID_FAIL";

const AUTH_USER_KEY = "AUTH_USER_KEY";

function loggerClearUser() {
  try {
    const { NativeNotifications } = NativeModules;
    NativeNotifications.clearUser();
  } catch (error) {
    // console.log(`error: ${error}`);
  }

  Logger.clearUser();
}

function loggerSetUser({ userId, username, fullName }) {
  try {
    const { NativeNotifications } = NativeModules;
    NativeNotifications.setUser(userId, username, fullName);
  } catch (error) {
    // console.log(`error: ${error}`);
  }

  Logger.setUser({ userId, username, fullName });
}

// NOTE: authSignInReset may be called on every keystroke in SignInForm
const authSignInReset = () => () => {
  return {
    type: AUTH_SIGN_IN_RESET,
  };
};

const authSignOutAsync = () => async dispatch => {
  let authUser = {};
  try {
    authUser = JSON.parse(await AsyncStorage.getItem(AUTH_USER_KEY)) || {};
    AsyncStorage.removeItem(AUTH_USER_KEY);
    if (authUser)
      api().signOutAsync({userId: authUser.userId, token: authUser.tokenNotification })
  } catch (error) {
    // console.log(
    //   `authSignOutAsync: failed to remove auth token on sign out`,
    //   error
    // );
  }

  Metrics.track({ metric: "Logged Out", shouldFlushBuffer: true });

  loggerClearUser();
  api().cacheControl.clear();
  dispatch(authSignInReset());
  dispatch(navigateSignIn());
};

const authSignInDidStart = () => ({
  type: AUTH_SIGN_IN_DID_START,
});

const authSignInDidSucceed = ({ authUser }) => {
  loggerSetUser(authUser);
  return {
    type: AUTH_SIGN_IN_DID_SUCCEED,
    payload: authUser,
  };
};

const authSignInDidFail = errorMessage => ({
  type: AUTH_SIGN_IN_DID_FAIL,
  payload: errorMessage,
});

const authSignInAsync = ({ username, password }) => async dispatch => {
  dispatch(authSignInDidStart());

  const {
    sessionToken,
    userId,
    errorMessage: signInErrorMessage,
  } = await api().signInAsync({
    username,
    password,
  });

  if (!sessionToken) {
    // console.log(`authSignInAsync: no sessionToken` signInErrorMessage);
    dispatch(authSignInDidFail(signInErrorMessage));
  } else {
    const {
      errorMessage: fetchProfileErrorMessage,
      profile,
    } = await api().fetchProfileAsync({
      userId,
    });

    if (fetchProfileErrorMessage) {
      dispatch(authSignInDidFail(fetchProfileErrorMessage));
    } else {
      const authUser = { sessionToken, userId, username, ...profile };
      const { fullName } = profile;
      try {

      const { status: existingStatus } = await Permissions.getAsync(
         Permissions.NOTIFICATIONS
       );
       let finalStatus = existingStatus;

       // Only ask if permissions have not already been determined, for iOS.
       if (existingStatus !== 'granted') {
         const { status } = await Permissions.askAsync(Permissions.NOTIFICATIONS);
         finalStatus = status;
       }

       let rol = null
       if ('clinic' in authUser)
         rol = 'clinic'
      else if ('patient' in authUser)
               rol = 'patient'

      // Stop here if the user did not grant permissions
       if (finalStatus === 'granted' && rol) {
           const token = await Notifications.getExpoPushTokenAsync();
           api().saveTokenAsync({ token, userId, rol });
           authUser.tokenNotification = token
       }

        AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(authUser));
        dispatch(authSignInDidSucceed({ authUser }));
        const { isOnline } = ConnectionStatus;
        if (isOnline) {
          Metrics.track({ metric: "Logged In" });
        }
        await dispatch(currentProfileRestoreAsync({ authUser }));
        if (isOnline) {
          api().fetchViewableUserProfilesAsync({ userId, fullName }); // Fetch viewable user profiles to seed the offline cache
        }
        dispatch(navigateHome());
      } catch (error) {
        dispatch(authSignInDidFail(error.errorMessage));
      }
    }
  }
};

const authRefreshTokenDidStart = () => ({
  type: AUTH_REFRESH_SESSION_TOKEN_DID_START,
});

const authRefreshTokenDidSucceed = ({ authUser }) => {
  loggerSetUser(authUser);
  return {
    type: AUTH_REFRESH_SESSION_TOKEN_DID_SUCCEED,
    payload: authUser,
  };
};

const authRefreshTokenDidFail = errorMessage => ({
  type: AUTH_REFRESH_SESSION_TOKEN_DID_FAIL,
  payload: errorMessage,
});

const authRefreshTokenOrSignInAsync = () => async dispatch => {
  dispatch(authRefreshTokenDidStart());

  let authUser = {};
  try {
    authUser = JSON.parse(await AsyncStorage.getItem(AUTH_USER_KEY)) || {};
  } catch (error) {
    // console.log(`authRefreshTokenOrSignInAsync`, error);
  }

  if (!authUser.sessionToken) {
    // console.log(
    //   `authRefreshTokenOrSignInAsync: No session token exists, navigate to sign in`
    // );
    dispatch(authRefreshTokenDidSucceed({ authUser }));
    dispatch(authSignInReset());
    dispatch(navigateSignIn());
  } else {
    // console.log(
    //   `authRefreshTokenOrSignInAsync: We have a cached session token, try to refresh it`
    // );

    const {
      sessionToken,
      userId,
      errorMessage,
    } = await api().refreshTokenAsync(authUser);
    if (errorMessage) {
      // console.log(`authRefreshTokenOrSignInAsync error`, errorMessage);
      dispatch(authRefreshTokenDidFail(errorMessage));
      // console.log(
      //   `authRefreshTokenOrSignInAsync: Navigate to sign in due to error`
      // ); // TODO: sign in - what about client side errors? Those should not result in reset / sign in
      loggerClearUser();
      api().cacheControl.clear();
      dispatch(authSignInReset());
      dispatch(navigateSignIn());
    } else {
      // console.log(`authRefreshTokenOrSignInAsync: Success!`);
      authUser.sessionToken = sessionToken;
      authUser.userId = userId;

      const {
        errorMessage: fetchProfileErrorMessage,
        profile,
      } = await api().fetchProfileAsync({
        userId,
      });

      if (fetchProfileErrorMessage) {
        // console.log(
        //   `authRefreshTokenOrSignInAsync fetchProfileAsync error`,
        //   fetchProfileErrorMessage
        // );
        dispatch(authSignInDidFail(fetchProfileErrorMessage));
        // console.log(
        //   `authRefreshTokenOrSignInAsync: Navigate to sign in due to error`
        // ); // TODO: sign in - what about client side errors? Those should not result in reset / sign in
        loggerClearUser();
        api().cacheControl.clear();
        dispatch(authSignInReset());
        dispatch(navigateSignIn());
      } else {
        authUser = { ...authUser, ...profile };
        const { fullName } = profile;
        try {
          AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(authUser));
          dispatch(authRefreshTokenDidSucceed({ authUser }));
          await dispatch(currentProfileRestoreAsync({ authUser }));
          if (ConnectionStatus.isOnline) {
            api().fetchViewableUserProfilesAsync({ userId, fullName }); // Fetch viewable user profiles to seed the offline cache
          }
          dispatch(navigateHome());
        } catch (error) {
          // console({ error });
          dispatch(authSignInDidFail(error.errorMessage));
        }
      }
    }
  }
};

export {
  authSignInReset,
  authSignOutAsync,
  authSignInDidStart,
  authSignInDidSucceed,
  authSignInDidFail,
  authSignInAsync,
  authRefreshTokenDidStart,
  authRefreshTokenDidSucceed,
  authRefreshTokenDidFail,
  authRefreshTokenOrSignInAsync,
  AUTH_SIGN_IN_RESET,
  AUTH_SIGN_IN_DID_START,
  AUTH_SIGN_IN_DID_SUCCEED,
  AUTH_SIGN_IN_DID_FAIL,
  AUTH_REFRESH_SESSION_TOKEN_DID_START,
  AUTH_REFRESH_SESSION_TOKEN_DID_SUCCEED,
  AUTH_REFRESH_SESSION_TOKEN_DID_FAIL,
};
