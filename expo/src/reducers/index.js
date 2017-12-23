import { combineReducers } from "redux";

import appInitDidFinish from "./appInitDidFinish";
import appVersion from "./appVersion";
import auth from "./auth";
import apiEnvironment from "./apiEnvironment";
import navigation from "./navigation";
import notesFetch from "./notesFetch";
import profile from "./profile";

const reducers = combineReducers({
  appInitDidFinish,
  appVersion,
  auth,
  apiEnvironment,
  navigation,
  notesFetch,
  profile,
});

export default reducers;
