import React, { PureComponent } from "react";
import PropTypes from "prop-types";

import Metrics from "../models/Metrics";
import DrawerButton from "./DrawerButton";

class DrawerSwitchProfileButton extends PureComponent {
  onPress = () => {
    const { navigateDrawerClose, navigateSwitchProfile } = this.props;
    Metrics.track({ metric: "Clicked switch profile (Home screen)" });
    navigateDrawerClose();
    navigateSwitchProfile();
  };

  render() {
    return (
      <DrawerButton
        onPress={this.onPress}
        title="Cambiar de perfil"
        hasDisclosureIndicator
      />
    );
  }
}

DrawerSwitchProfileButton.propTypes = {
  navigateSwitchProfile: PropTypes.func.isRequired,
  navigateDrawerClose: PropTypes.func.isRequired,
};

export default DrawerSwitchProfileButton;
