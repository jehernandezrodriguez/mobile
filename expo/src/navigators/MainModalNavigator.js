import { StackNavigator } from "react-navigation";

import MainStackNavigator from "./MainStackNavigator";
import AddOrEditNoteScreenContainer from "../containers/AddOrEditNoteScreenContainer";
import AddOrEditCommentScreenContainer from "../containers/AddOrEditCommentScreenContainer";

export const ADD_NOTE_ROUTE_NAME = "ADD_NOTE_ROUTE_NAME";
export const EDIT_NOTE_ROUTE_NAME = "EDIT_NOTE_ROUTE_NAME";
export const ADD_COMMENT_ROUTE_NAME = "ADD_COMMENT_ROUTE_NAME";
export const EDIT_COMMENT_ROUTE_NAME = "EDIT_COMMENT_ROUTE_NAME";

const transitionConfig = () => ({
  transitionSpec: {
    duration: 350,
  },
});

const MainModalNavigator = StackNavigator(
  {
    MainStackNavigator: { screen: MainStackNavigator },
    [ADD_NOTE_ROUTE_NAME]: {
      screen: AddOrEditNoteScreenContainer,
    },
    [EDIT_NOTE_ROUTE_NAME]: {
      screen: AddOrEditNoteScreenContainer,
    },
    [ADD_COMMENT_ROUTE_NAME]: {
      screen: AddOrEditCommentScreenContainer,
    },
  },
  {
    mode: "modal",
    headerMode: "none",
    transitionConfig,
  }
);

export default MainModalNavigator;
