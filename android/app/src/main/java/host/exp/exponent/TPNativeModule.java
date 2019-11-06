package host.exp.exponent;

import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class TPNativeModule extends ReactContextBaseJavaModule {

  public TPNativeModule(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  @Override
  public String getName() {
    return "TPNative";
  }

  @ReactMethod
  public void setEnvironment(String environment) {
    MainApplication application = (MainApplication) (this.getReactApplicationContext().getApplicationContext());
    application.setEnvironment(environment);
  }

  @ReactMethod
  public void setUser(String userId, String username, String userFullName, boolean isDSAUser, String sessionToken) {
    // NOTE: sessionToken is not currently needed on Android native side of bridge. iOS does need it, though, for Health data uploading
    MainApplication application = (MainApplication) (this.getReactApplicationContext().getApplicationContext());
    application.setUser(userId, username, userFullName, isDSAUser);
  }

  @ReactMethod
  public void clearUser() {
    MainApplication application = (MainApplication) (this.getReactApplicationContext().getApplicationContext());
    application.clearUser();
  }

  @ReactMethod
  public void testNativeCrash() {
    MainApplication application = (MainApplication) (this.getReactApplicationContext().getApplicationContext());
    application.testNativeCrash();
  }

  @ReactMethod
  public void testLogWarning(String message) {
    MainApplication application = (MainApplication) (this.getReactApplicationContext().getApplicationContext());
    application.testLogWarning(message);
  }

  @ReactMethod
  public void testLogError(String message) {
    MainApplication application = (MainApplication) (this.getReactApplicationContext().getApplicationContext());
    application.testLogError(message);
  }

  @ReactMethod
  public boolean isUploaderLoggingEnabled() {
    // Not implemented for Android
    return false;
  }

  @ReactMethod
  public void enableUploaderLogging(boolean enable) {
    // Not implemented for Android
  }

  @ReactMethod
  public void emailUploaderLogs() {
    // Not implemented for Android
  }
}