import { Platform } from "react-native";

import FontStyles from "../constants/FontStyles";
import Colors from "../constants/Colors";

const PrimaryTheme = {
  colors: {
    lightBackground: Colors.veryLightGrey,
  },
  navHeaderTitleStyle: {
    color: "white",
    ...FontStyles.navTitleFont,
    alignSelf: "center",
  },
  noteListItemTimeStyle: {
    color: Colors.altDarkGreyColor,
    ...FontStyles.smallRegularFont,
  },
  noteListItemTextStyle: {
    color: Colors.blackish,
    ...FontStyles.mediumSmallRegularFont,
  },
  noteListItemHashtagStyle: {
    color: Colors.blackish,
    ...FontStyles.mediumSmallBoldFont,
  },
  versionStringStyle: {
    color: Colors.warmGrey,
    ...FontStyles.mediumRegularFont,
  },
  madePossibleByTextStyle: {
    color: Colors.warmGrey,
    ...FontStyles.mediumSemiboldFont,
  },
  profileListItemName: {
    color: Colors.darkPurple,
    ...FontStyles.mediumSmallRegularFont,
  },
  drawerMenuConnectToHealthTextStyle: {
    color: Colors.darkPurple,
    ...FontStyles.mediumSmallRegularFont,
  },
  drawerMenuCurrentUserTextStyle: {
    color: Colors.brightBlue,
    ...FontStyles.mediumSmallSemiboldFont,
  },
  titleColorActive: "white",
  underlayColor: Colors.brightBlue,
  drawerMenuButtonStyle: {
    titleColorGrey: Colors.mediumLightGrey,
    titleColorBlue: Colors.brightBlue,
    titleFontStyle: {
      ...FontStyles.mediumSmallRegularFont,
    },
    subtitleFontStyle: {
      ...FontStyles.verySmallSemiboldFont,
    },
  },
  wrongEmailOrPasswordTextStyle: {
    color: Colors.redError,
    ...FontStyles.mediumSemiboldFont,
  },
  forgotPasswordTextStyle: {
    color: Colors.warmGrey,
    ...FontStyles.mediumRegularFont,
  },
  signUpTextStyle: {
    ...FontStyles.mediumBoldFont,
  },
  signInEditFieldStyle: {
    ...FontStyles.largeRegularFont,
    ...Platform.select({
      ios: {
        backgroundColor: "white",
      },
    }),
  },
  signInEditFieldExtra: {
    keyboardAppearance: "dark",
  },
};

export default PrimaryTheme;