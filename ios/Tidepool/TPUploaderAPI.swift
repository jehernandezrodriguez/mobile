/*
 * Copyright (c) 2019, Tidepool Project
 *
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the associated License, which is identical to the BSD 2-Clause
 * License as published by the Open Source Initiative at opensource.org.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the License for more details.
 *
 * You should have received a copy of the License along with this program; if
 * not, you can obtain one from Tidepool Project at tidepool.org.
 */

import CocoaLumberjack
import Foundation
import TPHealthKitUploader

/// The singleton of this class, accessed and initialized via TPUploaderAPI.connector(), initializes the uploader interface and provides it with the necessary callback functions.
class TPUploaderAPI: TPUploaderConfigInfo {
    static var _connector: TPUploaderAPI?
    /// Supports a singleton for the application.
    class func connector() -> TPUploaderAPI {
        if _connector == nil {
            let connector = TPUploaderAPI.init()
            connector.configure()
            _connector = connector
        }
        return _connector!
    }

    /// Use this to call various framework api's
    private var _uploader: TPUploader?
    func uploader() -> TPUploader {
        return _uploader!
    }

    private init() {
        api = TPApi.sharedInstance
        dataController = TPDataController.sharedInstance
    }

    private func configure() {
        _uploader = TPUploader(self)
    }

    private let api: TPApi
    private let dataController: TPDataController

    //
    // MARK: - TPUploaderConfigInfo protocol
    //

    //
    // Service API functions
    //
    func isConnectedToNetwork() -> Bool {
        let result = api.isConnectedToNetwork()
        DDLogInfo("\(#function) - TPUploaderConfigInfo protocol, returning: \(result)")
        return result
    }

    func sessionToken() -> String? {
        let result = api.sessionToken
        let includeSensitiveInfo = TPSettings.sharedInstance.includeSensitiveInfo
        if includeSensitiveInfo {
            DDLogInfo("\(#function) - TPUploaderConfigInfo protocol, returning: \(result ?? "nil")")
        } else {
            DDLogInfo("\(#function) - TPUploaderConfigInfo protocol, returning: <redacted>")
        }
        return result
    }

    func baseUrlString() -> String? {
        let result = api.baseUrlString
        DDLogInfo("\(#function) - TPUploaderConfigInfo protocol, returning: \(result ?? "nil")")
        return result
    }

    func currentUserId() -> String? {
        let result = dataController.currentUserId
        DDLogInfo("\(#function) - TPUploaderConfigInfo protocol, returning: \(result ?? "nil")")
        return result
    }

    var currentUserName: String? {
        get {
            let result = dataController.currentUserFullName
            DDLogInfo("\(#function) - TPUploaderConfigInfo protocol, returning: \(result ?? "nil")")
            return result
        }
    }

    func isDSAUser() -> Bool {
        let result = dataController.currentUserIsDSAUser
        DDLogInfo("\(#function) - TPUploaderConfigInfo protocol, returning: \(String(describing: result))")
        return result
    }

    var bioSex: String? {
        get {
            DDLogInfo("\(#function) - TPUploaderConfigInfo protocol, returning: \(String(describing: dataController.bioSex))")
            return dataController.bioSex
        }
        set {
            // TODO: uploader - also reflect this to AsyncStorage?
            dataController.bioSex = newValue
        }
    }

    var nativeHealthBridge: TPNativeHealth?
    
    var interfaceTurnedOffError: Error? = nil

    func onTurningOnInterface() {
        DDLogInfo("onTurningOnInterface")
        interfaceTurnedOffError = nil
        nativeHealthBridge?.onHealthKitInterfaceConfiguration()
    }

    func onTurnOnInterface() {
        DDLogInfo("onTurnOnInterface")
        interfaceTurnedOffError = nil
        nativeHealthBridge?.onHealthKitInterfaceConfiguration()
    }

    func onTurnOffInterface(_ error: Error?) {
        DDLogInfo("onTurnOffInterface, error: \(String(describing: error))")
                
        interfaceTurnedOffError = error
        nativeHealthBridge?.onHealthKitInterfaceConfiguration()
    }

    func samplesUploadLimits() -> [Int] {
        return TPSettings.sharedInstance.samplesUploadLimits
    }
    
    func uploaderTimeouts() -> [Int] {
        return TPSettings.sharedInstance.uploaderTimeouts
    }
    
    func deletesUploadLimits() -> [Int] {
        return TPSettings.sharedInstance.deletesUploadLimits
    }
    
    func supressUploadDeletes() -> Bool {
        return TPSettings.sharedInstance.uploaderSuppressDeletes
    }
    
    func simulateUpload() -> Bool {
        return TPSettings.sharedInstance.uploaderSimulate
    }
    
    func includeSensitiveInfo() -> Bool {
        return TPSettings.sharedInstance.includeSensitiveInfo
    }

    let uploadFramework: StaticString = "uploader"
    func logVerbose(_ str: String) {
        DDLogVerbose(str, file: uploadFramework, function: uploadFramework)
    }

    func logError(_ str: String) {
        DDLogError(str, file: uploadFramework, function: uploadFramework)
    }

    func logInfo(_ str: String) {
        DDLogInfo(str, file: uploadFramework, function: uploadFramework)
    }

    func logDebug(_ str: String) {
        DDLogDebug(str, file: uploadFramework, function: uploadFramework)
    }
}
