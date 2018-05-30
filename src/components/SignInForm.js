import React, { PureComponent } from "react";
import PropTypes from "prop-types";
import { ActivityIndicator, Keyboard, Platform } from "react-native";
import glamorous, { withTheme } from "glamorous-native";

import { ThemePropType } from "../prop-types/theme";
import Button from "./Button";

// TODO: polish - look at fixing flashing on Android with dismissal of keyboard when hitting next button. Fixed in later RN?
// TODO: polish - the error message doesn't seem to scroll in sync with the rest of the form with KeyboardAvoidingView? But, only on iOS, it seems

class SignInForm extends PureComponent {
  static ACTIVITY_INDICATOR_VIEW_HEIGHT = 62;

  constructor(props) {
    super(props);

    this.state = {
      username: "",
      password: "",
    };
  }

  onContainerViewLayout = event => {
    this.props.onKeyboardAvoidingViewHeight(
      event.nativeEvent.layout.height -
        SignInForm.ACTIVITY_INDICATOR_VIEW_HEIGHT
    );
  };

  onPressSignIn = () => {
    if (this.state.username.length > 0 && this.state.password.length > 0) {
      Keyboard.dismiss();
      this.props.authSignInAsync({
        username: this.state.username,
        password: this.state.password,
      });
    }
  };

  onPressForgotPassword = () => {
    this.props.navigateForgotPassword();
  };

  renderErrorMessage() {
    const { theme, errorMessage } = this.props;
    return (
      <glamorous.Text
        allowFontScaling={false}
        style={theme.wrongEmailOrPasswordTextStyle}
        alignSelf="flex-start"
        paddingLeft={3}
        marginTop={-15}
        marginBottom={Platform.OS === "android" ? -3 : 8}
      >
        {errorMessage || " "}
      </glamorous.Text>
    );
  }

  render() {
    const { theme, signingIn } = this.props;

    return (
      <glamorous.View onLayout={this.onContainerViewLayout}>
        <glamorous.Image
          source={require("../../assets/images/tidepool-logo-horizontal.png")}
          width={262}
          height={28.5}
          marginBottom={25}
          alignSelf="center"
        />
        {this.renderErrorMessage()}
        <glamorous.TextInput
          value={this.state.username}
          allowFontScaling={false}
          innerRef={textInput => {
            this.emailTextInput = textInput;
          }}
          style={theme.signInEditFieldStyle}
          returnKeyType="next"
          selectionColor="#657ef6"
          underlineColorAndroid="#657ef6"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Email"
          placeholderTextColor={theme.signInEditFieldExtra.placeholderTextColor}
          keyboardAppearance={theme.signInEditFieldExtra.keyboardAppearance}
          borderColor="#e2e3e4"
          height={47.5}
          borderWidth={Platform.OS === "android" ? 0 : 1}
          paddingLeft={Platform.OS === "android" ? 3 : 12}
          onSubmitEditing={() => {
            this.passwordTextInput.focus();
          }}
          onChangeText={username => {
            this.setState({ username });
            this.props.authSignInReset();
          }}
        />
        <glamorous.TextInput
          value={this.state.password}
          allowFontScaling={false}
          innerRef={textInput => {
            this.passwordTextInput = textInput;
          }}
          style={theme.signInEditFieldStyle}
          secureTextEntry
          returnKeyType="go"
          selectionColor="#657ef6"
          underlineColorAndroid="#657ef6"
          placeholder="Password"
          placeholderTextColor={theme.signInEditFieldExtra.placeholderTextColor}
          keyboardAppearance={theme.signInEditFieldExtra.keyboardAppearance}
          borderColor="#e2e3e4"
          height={47.5}
          borderWidth={Platform.OS === "android" ? 0 : 1}
          paddingLeft={Platform.OS === "android" ? 3 : 12}
          marginTop={15}
          onChangeText={password => {
            this.setState({ password });
            this.props.authSignInReset();
          }}
          onSubmitEditing={this.onPressSignIn}
        />
        <glamorous.View flexDirection="row" marginLeft={-8}>
          <glamorous.TouchableOpacity
            padding={8}
            onPress={this.onPressForgotPassword}
          >
            <glamorous.Text
              allowFontScaling={false}
              style={theme.forgotPasswordTextStyle}
              alignSelf="flex-start"
              paddingLeft={3}
            >
              Forgot password?
            </glamorous.Text>
          </glamorous.TouchableOpacity>
        </glamorous.View>
        <glamorous.View
          marginTop={-5}
          flexDirection="row"
          justifyContent="flex-end"
        >
          <Button
            onPress={this.onPressSignIn}
            title="Log in"
            disabled={
              signingIn ||
              this.state.username.length === 0 ||
              this.state.password.length === 0
            }
          />
        </glamorous.View>
        {/* Keep this wrapper view with same height as the ActivityIndicator to avoid layout shift when showing and
            hiding ActivityIndicator. Don't render ActivityIndicator unless signingIn is true. Ideally we should be
            able to remove wrapper view and just set animating property based on signingIn, but, this React Native
            bug for Android prevents that:
            https://github.com/facebook/react-native/issues/9023
            https://github.com/facebook/react-native/issues/11682
            */}
        <glamorous.View
          style={{
            height: SignInForm.ACTIVITY_INDICATOR_VIEW_HEIGHT,
          }}
        >
          {this.props.signingIn && (
            <ActivityIndicator
              style={{
                height: SignInForm.ACTIVITY_INDICATOR_VIEW_HEIGHT,
                alignSelf: "center",
              }}
              size="large"
              color={theme.colors.activityIndicator}
              animating
            />
          )}
        </glamorous.View>
      </glamorous.View>
    );
  }
}

SignInForm.propTypes = {
  theme: ThemePropType.isRequired,
  authSignInReset: PropTypes.func.isRequired,
  authSignInAsync: PropTypes.func.isRequired,
  navigateForgotPassword: PropTypes.func.isRequired,
  signingIn: PropTypes.bool.isRequired,
  errorMessage: PropTypes.string,
  onKeyboardAvoidingViewHeight: PropTypes.func,
};

SignInForm.defaultProps = {
  errorMessage: "",
  onKeyboardAvoidingViewHeight: () => {},
};

export default withTheme(SignInForm);