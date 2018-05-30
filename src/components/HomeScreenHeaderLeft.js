import React, { PureComponent } from "react";
import PropTypes from "prop-types";
import { Image, TouchableOpacity } from "react-native";

class HomeScreenHeaderLeft extends PureComponent {
  onPress = () => {
    this.props.navigateDrawerOpen();
  };

  render() {
    return (
      <TouchableOpacity
        style={{
          padding: 10,
          marginLeft: 6,
        }}
        onPress={this.onPress}
      >
        <Image
          tintColor="white"
          source={require("../../assets/images/menu-button.png")}
        />
      </TouchableOpacity>
    );
  }
}

HomeScreenHeaderLeft.propTypes = {
  navigateDrawerOpen: PropTypes.func.isRequired,
};

export default HomeScreenHeaderLeft;