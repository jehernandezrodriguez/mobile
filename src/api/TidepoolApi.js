import { Platform, Alert } from "react-native";
import axios from "axios";
import uuidv4 from "uuid/v4";
import parse from "date-fns/parse";
import DeviceInfo from "react-native-device-info";
import Constants from "expo-constants";
import ConnectionStatus from "../models/ConnectionStatus";
import {
  MMOL_PER_L_TO_MG_PER_DL,
  UNITS_MMOL_PER_L,
} from "../components/Graph/helpers";
import GraphData from "../models/GraphData";
import { TidepoolApiCache } from "./TidepoolApiCache";
import { TidepoolApiCacheControl } from "./TidepoolApiCacheControl";

// TODO: api - update User-Agent in the header for all requests to indicate the app name and version, build info,
// iOS version, etc, similar to Tidepool Mobile, e.g.:
// "Nutshell/2.0.3 (org.tidepool.blipnotes; build:460; iOS 11.1.0) Alamofire/4.3.0")
// "Nutshell/460 CFNetwork/889.9 Darwin/17.2.0"

const timeout = 30000;

class TidepoolApi {
  constructor({ baseUrl, baseURLNotifications }) {
    this.baseUrl = baseUrl;
    this.baseURLNotifications = baseURLNotifications;
    this.sessionToken = "";
    this.tasksInProgress = 0; // Count of in-flight TidepoolApi tasks

    // Cache
    this.cache = new TidepoolApiCache(); // Used internally in TidepoolApi to fetch from cache when offline and save to cache when online
    this.cacheControl = new TidepoolApiCacheControl(this.cache); // Used by app to control cache (clear, trim, preload, etc)
  }

  //
  // Async helpers
  //

  async refreshTokenAsync(authUser) {
    if (ConnectionStatus.isOffline) {
      return authUser;
    }

    this.tasksInProgress += 1;

    const { sessionToken: previousSessionToken } = authUser;
    const { sessionToken, userId, errorMessage } = await this.refreshTokenPromise({
      sessionToken: previousSessionToken,
    })
      .then(response => ({
        sessionToken: response.sessionToken,
        userId: response.userId,
      }))
      .catch(error => ({
        errorMessage: error.message,
      }));

    this.sessionToken = sessionToken;

    this.tasksInProgress -= 1;

    // If we transitioned to offline while this request was being fulfilled, just use the offline data instead
    if (ConnectionStatus.isOffline) {
      return authUser;
    }

    return { sessionToken, userId, errorMessage };
  }

  async signInAsync({ username, password }) {
    if (ConnectionStatus.isOffline) {
      return { errorMessage: "Check your Internet connection!" };
    }

    this.tasksInProgress += 1;

    const { sessionToken, userId, errorMessage } = await this.signInPromise({
      username,
      password,
    })
      .then(response => ({
        sessionToken: response.sessionToken,
        userId: response.userId,
      }))
      .catch(error => ({
        errorMessage: error.message,
      }));

    this.sessionToken = sessionToken;

    this.tasksInProgress -= 1;

    // If we transitioned to offline while this request was being fulfilled, just use the offline data instead
    if (ConnectionStatus.isOffline) {
      return { errorMessage: "¡Comprueba tu conexión a Internet!" };
    }

    return { sessionToken, userId, errorMessage };
  }

  async fetchProfileAsync({ userId }) {
    if (ConnectionStatus.isOffline) {
      return this.cache.fetchProfileAsync({ userId });
    }

    this.tasksInProgress += 1;

    const { errorMessage, ...rest } = await this.fetchProfilePromise({
      userId,
    })
      .then(response => {
        const profile = response;
        this.cache.saveProfileAsync({ userId, profile });
        return {
          profile,
          isAvailableOffline: true,
        };
      })
      .catch(error => ({
        errorMessage: error.message,
      }));

    this.tasksInProgress -= 1;

    // If we transitioned to offline while this request was being fulfilled, just use the offline data instead
    if (ConnectionStatus.isOffline) {
      return this.cache.fetchProfileAsync({ userId });
    }

    return { userId, ...rest, errorMessage };
  }

  async fetchProfileSettingsAsync({ userId }) {
    if (ConnectionStatus.isOffline) {
      return this.cache.fetchProfileSettingsAsync({ userId });
    }

    this.tasksInProgress += 1;

    const { errorMessage, ...rest } = await this.fetchProfileSettingsPromise({
      userId,
    })
      .then(response => {
        this.cache.saveProfileSettingsAsync({
          userId,
          settings: response.settings,
        });
        return {
          settings: response.settings,
          isAvailableOffline: true,
        };
      })
      .catch(error => ({
        errorMessage: error.message,
      }));

    this.tasksInProgress -= 1;

    // If we transitioned to offline while this request was being fulfilled, just use the offline data instead
    if (ConnectionStatus.isOffline) {
      return this.cache.fetchProfileSettingsAsync({ userId });
    }

    return {  ...rest, errorMessage };
  }

  async fetchNotesAsync({ userId }) {
    if (ConnectionStatus.isOffline) {
      return this.cache.fetchNotesAsync({ userId });
    }

    this.tasksInProgress += 1;

    const { errorMessage, ...rest } = await this.fetchNotesPromise({
      userId,
    })
      .then(response => {
        // Map notes
        const sortedNotes = response.notes.map(responseNote => {
          let userFullName = "";
          if (responseNote.user && responseNote.user.fullName) {
            userFullName = responseNote.user.fullName;
          }

          const mappedNote = {
            id: responseNote.id,
            timestamp: parse(responseNote.timestamp),
            messageText: responseNote.messagetext,
            parentMessageId: responseNote.parentmessage,
            userId: responseNote.userid,
            userFullName,
            groupId: responseNote.groupid,
            createdTime: responseNote.createdtime,
          };
          return mappedNote;
        });
        // Sort notes reverse chronologically by timestamp
        sortedNotes.sort((note1, note2) => note2.timestamp - note1.timestamp);

        this.cache.saveNotesAsync({ userId, notes: sortedNotes });
        return { notes: sortedNotes, isAvailableOffline: true };
      })
      .catch(error => ({
        errorMessage: error.message,
      }));

    this.tasksInProgress -= 1;

    // If we transitioned to offline while this request was being fulfilled, just use the offline data instead
    if (ConnectionStatus.isOffline) {
      return this.cache.fetchNotesAsync({ userId });
    }

    return { ...rest, errorMessage };
  }

  async fetchCommentsAsync({ messageId }, fetchOnlyFromCache = false) {
    if (fetchOnlyFromCache || ConnectionStatus.isOffline) {
      return this.cache.fetchCommentsAsync({ messageId });
    }

    this.tasksInProgress += 1;

    const { errorMessage, ...rest } = await this.fetchCommentsPromise({
      messageId,
    })
      .then(response => {
        // Map comments
        const sortedComments = response.comments.map(responseComment => {
          const mappedComment = {
            id: responseComment.id,
            timestamp: parse(responseComment.timestamp),
            messageText: responseComment.messagetext,
            parentMessageId: responseComment.parentmessage,
            userId: responseComment.userid,
            groupId: responseComment.groupid,
            createdTime: responseComment.createdtime,
            userFullName: responseComment.user.fullName,
          };
          return mappedComment;
        });
        // Sort comments chronologically by timestamp
        sortedComments.sort(
          (comment1, comment2) => comment1.timestamp - comment2.timestamp
        );

        if (!fetchOnlyFromCache) {
          this.cache.saveCommentsAsync({
            messageId,
            comments: sortedComments,
          });
        }

        return { comments: sortedComments, isAvailableOffline: true };
      })
      .catch(error => ({
        errorMessage: error.message,
      }));

    this.tasksInProgress -= 1;

    // If we transitioned to offline while this request was being fulfilled, just use the offline data instead
    if (ConnectionStatus.isOffline) {
      return this.cache.fetchCommentsAsync({ messageId });
    }

    return { errorMessage, ...rest };
  }

  async fetchViewableUserProfilesAsync({ userId, fullName }) {
    if (ConnectionStatus.isOffline) {
      return this.cache.fetchViewableUserProfilesAsync({
        userId,
      });
    }

    this.tasksInProgress += 1;

    let errorMessage;
    let profiles = [];

    // Get other viewable user ids
    const {
      userIds,
      errorMessage: fetchOtherViewableUserIdsErrorMessage,
    } = await this.fetchOtherViewableUserIdsPromise({
      userId,
    })
      .then(response => {
        return {
          userIds: response.userIds,
        };
      })
      .catch(error => ({
        errorMessage: error.message,
      }));

    errorMessage = fetchOtherViewableUserIdsErrorMessage;

    // Get profiles for other viewable user ids
    if (!errorMessage) {
      const fetchProfilePromises = userIds.map(fetchProfileUserId =>
        this.fetchProfilePromise({ userId: fetchProfileUserId })
      );

      const {
        profiles: fetchProfilePromisesProfiles,
        errorMessage: fetchProfilePromisesErrorMessage,
      } = await Promise.all(fetchProfilePromises)
        .then(response => ({
          profiles: response,
        }))
        .catch(error => ({ fetchProfilePromisesErrorMessage: error.message }));

      errorMessage = fetchProfilePromisesErrorMessage;
      profiles = fetchProfilePromisesProfiles;
    }

    // Sort profiles by fullName
    profiles.sort((profile1, profile2) =>
      profile1.fullName.localeCompare(profile2.fullName)
    );

    // Add the specified user profile to front of list
    const viewableUserProfiles = [{ userId, fullName }, ...profiles];

    this.tasksInProgress -= 1;

    // If we transitioned to offline while this request was being fulfilled, just use the offline data instead
    if (ConnectionStatus.isOffline) {
      return this.cache.fetchViewableUserProfilesAsync({
        userId,
      });
    }

    this.cache.saveViewableUserProfilesAsync({
      userId,
      profiles: viewableUserProfiles,
    });

    return {
      profiles: viewableUserProfiles,
      errorMessage,
      isAvailableOffline: true,
    };
  }

  async addNoteAsync({ currentUser, currentProfile, messageText, timestamp }) {
    this.tasksInProgress += 1;

    const { errorMessage, note } = await this.addNotePromise({
      currentUser,
      currentProfile,
      messageText,
      timestamp,
    })
      .then(response => ({
        note: response.note,
      }))
      .catch(error => ({
        errorMessage: error.message,
      }));

      // rol a notificar
      let rol = '';

      if ('clinic' in currentUser)
        rol = 'clinic'
      else if ('patient' in currentUser)
        rol = 'patient'

      const data = { rol,
                     id: currentProfile.currentUserId,
                     time: note.timestamp.toISOString(),
                     fullName: currentUser.fullName ,
                     noteId: note.id,
                     senderId: currentUser.userId,
                    }

      if (rol === 'patient') {
         const {clinics} = await this.fetchProfileUsersPromise({userId: currentProfile.userId})
         for (let i = 0; i < clinics.length; i += 1) {
             if (clinics[i].userid) {
               data.id = clinics[i].userid
               this.saveNotificationPromise(data).catch(() => {
                   Alert.alert(
                     "Error",
                     "No se puede notificar al usuario. Es posible que necesite reiniciar la aplicación.",
                     [{ text: "OK" }]
                   );}
               );

             }
         }
      } else if (rol === 'clinic') { // send patient notification
          data.id = note.groupId
          this.saveNotificationPromise(data)
                                    .then(() => {})
                                    .catch(() => {
                                        Alert.alert(
                                          "Error",
                                          "No se puede notificar al usuario. Es posible que necesite reiniciar la aplicación.",
                                          [{ text: "OK" }]
                                        );}
                                    );
      }


    this.tasksInProgress -= 1;

    if (!errorMessage && ConnectionStatus.isOnline) {
      // Update notes in cache by fetching notes (which writes through to cache) for currentProfile
      const { userId } = currentProfile;
      this.fetchNotesAsync({ userId });
    }

    return { errorMessage, note };
  }

  async updateNoteAsync({ currentProfile, note }) {
    this.tasksInProgress += 1;

    const { errorMessage } = await this.updateNotePromise({
      note,
    })
      .then(() => ({}))
      .catch(error => ({
        errorMessage: error.message,
      }));

      // rol a notificar
        let rol = '';

        if ('clinic' in currentProfile)
          rol = 'clinic'
        else if ('patient' in currentProfile)
          rol = 'patient'

        const data = { rol,
                       id: currentProfile.currentUserId,
                       time: note.timestamp.toISOString(),
                       fullName: currentProfile.fullName,
                       noteId: note.id,
                       senderId: currentProfile.userId,
                      }
        if (rol === 'patient') { // notificar doctores
           const {clinics} = await this.fetchProfileUsersPromise({userId: currentProfile.userId})
           for (let i = 0; i < clinics.length; i += 1) {
              if (clinics[i].userid) {
               data.id = clinics[i].userid
               this.saveNotificationPromise(data)
               .then(() => {})
               .catch(() => {
                   Alert.alert(
                     "Error",
                     "No se puede notificar al otro usuario. Es posible que necesite reiniciar la aplicación.",
                     [{ text: "OK" }]
                   );}
               );
             }
           }
        } else if (rol === 'clinic') { // notificar paciente
          data.id = note.groupId
          data.fullName = note.userFullName
          data.senderId = currentProfile.currentUserId
          this.saveNotificationPromise(data)
                                    .then(() => {})
                                    .catch(() => {
                                        Alert.alert(
                                          "Error",
                                          "No se puede notificar al otro usuario. Es posible que necesite reiniciar la aplicación.",
                                          [{ text: "OK" }]
                                        );}
                                    );
        }

    this.tasksInProgress -= 1;

    if (!errorMessage && ConnectionStatus.isOnline) {
      // Update notes in cache by fetching notes (which writes through to cache) for currentProfile
      const { userId } = currentProfile;
      this.fetchNotesAsync({ userId });
    }

    return { errorMessage };
  }

  async deleteNoteAsync({ currentProfile, note }) {
    this.tasksInProgress += 1;

    const { id } = note;
    const { errorMessage } = await this.deleteCommentOrNotePromise({
      id,
    })
      .then(() => ({}))
      .catch(error => ({
        errorMessage: error.message,
      }));

    this.tasksInProgress -= 1;

    if (!errorMessage && ConnectionStatus.isOnline) {
      // Update notes in cache by fetching notes (which writes through to cache) for currentProfile
      const { userId } = currentProfile;
      this.fetchNotesAsync({ userId });
    }

    return { errorMessage };
  }

  async addCommentAsync({
    currentUser,
    currentProfile,
    note,
    messageText,
    timestamp,
  }) {
    this.tasksInProgress += 1;

    const { errorMessage, comment } = await this.addCommentPromise({
      currentUser,
      currentProfile,
      note,
      messageText,
      timestamp,
    })
      .then(response => ({
        comment: response.comment,
      }))
      .catch(error => ({
        errorMessage: error.message,
      }));

      let rol = '';

      if ('clinic' in currentUser)
        rol = 'clinic'
      else if ('patient' in currentUser)
        rol = 'patient'

      const data = { rol,
                     id: currentProfile.currentUserId,
                     time: timestamp.toISOString(),
                     fullName: currentUser.fullName ,
                     noteId: note.id,
                     senderId: currentUser.userId,
                     type: 'reply',
                    }

      if (rol === 'patient') {
         const {clinics} = await this.fetchProfileUsersPromise({userId: currentProfile.userId})
         for (let i = 0; i < clinics.length; i += 1) {
             if (clinics[i].userid) {
               data.id = clinics[i].userid
               this.saveNotificationPromise(data)
               .then(() => {})
               .catch(() => {
                   Alert.alert(
                     "Error",
                     "No se puede notificar al otro usuario. Es posible que necesite reiniciar la aplicación.",
                     [{ text: "OK" }]
                   );}
               );
             }
         }
      } else if (rol === 'clinic') { // send patient notification
          data.id = note.groupId
          this.saveNotificationPromise(data)
                                    .then(() => {})
                                    .catch(() => {
                                        Alert.alert(
                                          "Error",
                                          "No se puede notificar al otro usuario. Es posible que necesite reiniciar la aplicación.",
                                          [{ text: "OK" }]
                                        );}
                                    );
      }

    this.tasksInProgress -= 1;

    if (!errorMessage && ConnectionStatus.isOnline) {
      // Update comments in cache by fetching comments (which writes through to cache) for currentProfile
      this.fetchCommentsAsync({ messageId: note.id });
    }

    return { errorMessage, comment };
  }

  async updateCommentAsync({ note, comment }) {
    this.tasksInProgress += 1;

    const { errorMessage } = await this.updateCommentPromise({
      comment,
    })
      .then(() => ({}))
      .catch(error => ({
        errorMessage: error.message,
      }));

    this.tasksInProgress -= 1;

    if (!errorMessage && ConnectionStatus.isOnline) {
      // Update comments in cache by fetching comments (which writes through to cache) for currentProfile
      this.fetchCommentsAsync({ messageId: note.id });
    }

    return { errorMessage };
  }

  async deleteCommentAsync({ note, comment }) {
    this.tasksInProgress += 1;

    const { id } = comment;
    const { errorMessage } = await this.deleteCommentOrNotePromise({
      id,
    })
      .then(() => ({}))
      .catch(error => ({
        errorMessage: error.message,
      }));

    this.tasksInProgress -= 1;

    if (!errorMessage && ConnectionStatus.isOnline) {
      // Update comments in cache by fetching comments (which writes through to cache) for currentProfile
      this.fetchCommentsAsync({ messageId: note.id });
    }

    return { errorMessage };
  }

  async fetchGraphDataAsync(
    {
      userId,
      messageId,
      noteDate,
      startDate,
      endDate,
      objectTypes,
      lowBGBoundary,
      highBGBoundary,
    },
    fetchOnlyFromCache = false
  ) {
    let result;

    if (fetchOnlyFromCache || ConnectionStatus.isOffline) {
      result = await this.cache.fetchGraphDataAsync({
        userId,
        messageId,
      });
    } else {
      this.tasksInProgress += 1;

      result = await this.fetchGraphDataPromise({
        userId,
        noteDate,
        startDate,
        endDate,
        objectTypes,
        lowBGBoundary,
        highBGBoundary,
      })
        .then(responseData => {
          return {
            responseData,
          };
        })
        .catch(error => {
          // console.log({ error });
          return {
            errorMessage: error.message,
          };
        });

      this.tasksInProgress -= 1;

      // If we transitioned to offline while this request was being fulfilled, just use the offline data instead
      if (ConnectionStatus.isOffline) {
        result = await this.cache.fetchGraphDataAsync({
          userId,
          messageId,
        });
      }
    }

    let graphData;
    const { responseData, errorMessage } = result;
    let { isAvailableOffline } = result;
    if (responseData) {
      // console.log({ responseData });
      const noteTimeSeconds = noteDate.getTime() / 1000;
      const startDateSeconds = startDate.getTime() / 1000;
      const endDateSeconds = endDate.getTime() / 1000;
      graphData = new GraphData();
      graphData.addResponseData(responseData);
      graphData.process({
        eventTimeSeconds: noteTimeSeconds,
        timeIntervalSeconds: endDateSeconds - startDateSeconds,
        lowBGBoundary,
        highBGBoundary,
      });

      if (ConnectionStatus.isOnline && !fetchOnlyFromCache) {
        this.cache.saveGraphDataAsync({
          userId,
          messageId,
          responseData,
        });
        isAvailableOffline = true;
      }
    } else {
      graphData = new GraphData();
    }

    graphData.isAvailableOffline = isAvailableOffline;

    return { graphData, errorMessage, isAvailableOffline };
  }

  async trackMetricAsync({ metric }) {
    this.tasksInProgress += 1;

    const { errorMessage } = await this.trackMetricPromise({
      metric,
    })
      .then(() => ({}))
      .catch(error => ({
        errorMessage: error.message,
      }));

    this.tasksInProgress -= 1;

    return { errorMessage };
  }

  //
  // Lower-level Promise based methods
  //

  refreshTokenPromise({ sessionToken: previousSessionToken }) {
    const method = "get";
    const url = "/auth/login";
    const baseURL = this.baseUrl;
    const headers = { "x-tidepool-session-token": previousSessionToken };

    return new Promise((resolve, reject) => {
      axios({ method, url, baseURL, headers, timeout })
        .then(response => {
          this.sessionToken =
            response.headers["x-tidepool-session-token"] || "";
          this.userId = response.data.userid;

          if (this.sessionToken) {
            resolve({
              sessionToken: this.sessionToken,
              userId: this.userId,
            });
          } else {
            reject(
              new Error(
                "No x-tidepool-session-token was found in the response headers."
              )
            );
          }
        })
        .catch(error => {
          // console.log(`refreshTokenPromise error: ${error}`);
          if (
            error.response &&
            (error.response.status === 400 || error.response.status === 401)
          ) {
            reject(new Error("No se puede actualizar el token."));
          } else {
            reject(new Error("Comprueba tu conexión a Internet"));
          }
        });
    });
  }

  signInPromise({ username, password }) {
    const method = "post";
    const url = "/auth/login";
    const baseURL = this.baseUrl;
    const trimmedUsername = username.trim();
    const auth = {
      username: trimmedUsername,
      password,
    };

    return new Promise((resolve, reject) => {
      axios({ method, url, baseURL, auth, timeout })
        .then(response => {
          this.sessionToken =
            response.headers["x-tidepool-session-token"] || "";
          this.userId = response.data.userid;

          if (this.sessionToken) {
            resolve({ sessionToken: this.sessionToken, userId: this.userId });
          } else {
            reject(
              new Error(
                "No x-tidepool-session-token was found in the response headers"
              )
            );
          }
        })
        .catch(error => {
          if (
            error.response &&
            (error.response.status === 400 || error.response.status === 401)
          ) {
            reject(new Error("¡Contraseña o correo incorrecto!"));
          } else {
            reject(new Error("¡Comprueba tu conexión a Internet!"));
          }
        });
    });
  }

  fetchProfilePromise({ userId }) {
    const method = "get";
    const url = `/metadata/${userId}/profile`;
    const baseURL = this.baseUrl;
    const headers = { "x-tidepool-session-token": this.sessionToken };

    return new Promise((resolve, reject) => {
      axios({ method, url, baseURL, headers, timeout })
        .then(response => {
          resolve({ userId, ...response.data });
        })
        .catch(error => {
          reject(error);
        });
    });
  }

  fetchProfileSettingsPromise({ userId }) {
    const method = "get";
    const url = `/metadata/${userId}/settings`;
    const baseURL = this.baseUrl;
    const headers = { "x-tidepool-session-token": this.sessionToken };

    return new Promise((resolve, reject) => {
      axios({ method, url, baseURL, headers, timeout })
        .then(({ data: { bgTarget, units } }) => {
          if (bgTarget && bgTarget.low && bgTarget.high) {
            const shouldConvertToMgPerDl =
              units && units.bg === UNITS_MMOL_PER_L;
            const settings = {
              lowBGBoundary: shouldConvertToMgPerDl
                ? Math.round(bgTarget.low * MMOL_PER_L_TO_MG_PER_DL)
                : bgTarget.low,
              highBGBoundary: shouldConvertToMgPerDl
                ? Math.round(bgTarget.high * MMOL_PER_L_TO_MG_PER_DL)
                : bgTarget.high,
              units: units ? units.bg : undefined,
            };
            resolve({ settings });
          } else {
            reject(
              new Error(
                "No se encontró bgTarget en los datos de respuesta de configuración para el usuario."
              )
            );
          }
        })
        .catch(error => {
          reject(error);
        });
    });
  }

  fetchNotesPromise({ userId }) {
    const method = "get";
    const url = `/message/notes/${userId}`;
    const baseURL = this.baseUrl;
    const headers = { "x-tidepool-session-token": this.sessionToken };

    return new Promise((resolve, reject) => {
      axios({ method, url, baseURL, headers, timeout })
        .then(response => {
          const notes = response.data.messages;
          resolve({ notes });
        })
        .catch(error => {
          if (error.response && error.response.status === 404) {
            // console.log(
            //   `fetchNotesPromise: No notes retrieved, status code: ${
            //     error.response.status
            //   }, userid: ${userId}`
            // );
            resolve({ notes: [] });
          } else {
            reject(error);
          }
        });
    });
  }

  fetchCommentsPromise({ messageId }) {
    const method = "get";
    const url = `/message/thread/${messageId}`;
    const baseURL = this.baseUrl;
    const headers = { "x-tidepool-session-token": this.sessionToken };

    return new Promise((resolve, reject) => {
      axios({ method, url, baseURL, headers, timeout })
        .then(response => {
          const comments = response.data.messages;
          resolve({ comments });
        })
        .catch(error => {
          reject(error);
        });
    });
  }

  fetchOtherViewableUserIdsPromise({ userId }) {
    const method = "get";
    const url = `/access/groups/${userId}`;
    const baseURL = this.baseUrl;
    const headers = { "x-tidepool-session-token": this.sessionToken };

    return new Promise((resolve, reject) => {
      axios({ method, url, baseURL, headers, timeout })
        .then(response => {
          const userIds = Object.keys(response.data);

          // Remove userId, if exists, since we're only looking for other users
          const userIdIndex = userIds.indexOf(userId);
          if (userIdIndex !== -1) {
            userIds.splice(userIdIndex, 1);
          }

          resolve({ userIds });
        })
        .catch(error => {
          reject(error);
        });
    });
  }

  addNotePromise({ currentUser, currentProfile, messageText, timestamp }) {
    const method = "post";
    const groupId = currentProfile.userId;
    const url = `/message/send/${groupId}`;
    const baseURL = this.baseUrl;
    const headers = { "x-tidepool-session-token": this.sessionToken };
    const note = {
      groupId,
      parentMessage: null,
      userId: this.userId,
      timestamp,
      messageText,
      userFullName: currentUser.fullName,
    };

    return new Promise((resolve, reject) => {
      const data = {
        message: {
          groupid: note.groupId,
          parentmessage: note.parentMessage,
          guid: uuidv4(),
          userid: note.userId,
          timestamp: note.timestamp.toISOString(),
          messagetext: note.messageText,
        },
      };
      axios({ method, url, baseURL, headers, data, timeout })
        .then(response => {
          note.id = response.data.id;
          resolve({ note });
        })
        .catch(error => {
          reject(error);
        });
    });
  }

  updateNotePromise({ note }) {
    const method = "put";
    const url = `/message/edit/${note.id}`;
    const baseURL = this.baseUrl;
    const headers = { "x-tidepool-session-token": this.sessionToken };
    const data = {
      message: {
        timestamp: note.timestamp,
        messagetext: note.messageText,
      },
    };

    return new Promise((resolve, reject) => {
      axios({ method, url, baseURL, headers, data, timeout })
        .then(() => {
          resolve({});
        })
        .catch(error => {
          reject(error);
        });
    });
  }

  addCommentPromise({ currentUser, currentProfile, note, messageText, timestamp }) {
    const method = "post";
    const groupId = currentProfile.userId;
    const url = `/message/reply/${note.id}`;
    const baseURL = this.baseUrl;
    const headers = { "x-tidepool-session-token": this.sessionToken };
    const comment = {
      groupId,
      parentMessage: note.id,
      userId: this.userId,
      timestamp,
      messageText,
      userFullName: currentUser.fullName,
    };

    return new Promise((resolve, reject) => {
      const data = {
        message: {
          groupid: comment.groupId,
          parentmessage: comment.parentMessage,
          guid: uuidv4(),
          userid: comment.userId,
          timestamp: comment.timestamp.toISOString(),
          messagetext: comment.messageText,
        },
      };
      axios({ method, url, baseURL, headers, data, timeout })
        .then(response => {
          comment.id = response.data.id;
          resolve({ comment });
        })
        .catch(error => {
          reject(error);
        });
    });
  }

  updateCommentPromise({ comment }) {
    const method = "put";
    const url = `/message/edit/${comment.id}`;
    const baseURL = this.baseUrl;
    const headers = { "x-tidepool-session-token": this.sessionToken };
    const data = {
      message: {
        timestamp: comment.timestamp,
        messagetext: comment.messageText,
      },
    };

    return new Promise((resolve, reject) => {
      axios({ method, url, baseURL, headers, data, timeout })
        .then(() => {
          resolve({});
        })
        .catch(error => {
          reject(error);
        });
    });
  }

  deleteCommentOrNotePromise({ id }) {
    const method = "delete";
    const url = `/message/remove/${id}`;
    const baseURL = this.baseUrl;
    const headers = { "x-tidepool-session-token": this.sessionToken };

    return new Promise((resolve, reject) => {
      axios({ method, url, baseURL, headers, timeout })
        .then(() => {
          resolve({});
        })
        .catch(error => {
          reject(error);
        });
    });
  }

  fetchGraphDataPromise({ userId, startDate, endDate, objectTypes }) {
    const method = "get";
    const url = `/data/${userId}`;
    const params = {
      endDate: endDate.toISOString(),
      startDate: startDate.toISOString(),
      type: objectTypes,
    };
    const baseURL = this.baseUrl;
    const headers = { "x-tidepool-session-token": this.sessionToken };

    return new Promise((resolve, reject) => {
      axios({ method, url, params, baseURL, headers, timeout })
        .then(response => {
          // Omit extra properties from response data. This would otherwise
          // bloat the cached data, and, for some objects that have dots in key
          // names, would throw exception when saving in db. This whitelisted
          // response data is a superset of all the data for all the available
          // types in the data array
          let whitelistedResponseData = [];
          if (response.data && response.data.length > 0) {
            whitelistedResponseData = response.data.map(item => {
              return {
                // Common
                id: item.id,
                type: item.type,
                time: item.time,
                value: item.value,
                // Basal
                rate: item.rate,
                deliveryType: item.deliveryType,
                duration: item.duration,
                suppressed: item.suppressed,
                // Bolus
                normal: item.normal,
                extended: item.extended,
                //  duration, // Bolus and Basal share this
                expectedNormal: item.expectedNormal,
                expectedExtended: item.expectedExtended,
                expectedDuration: item.expectedDuration,
                // Wizard
                bolus: item.bolus,
                carbInput: item.carbInput,
                recommended: item.recommended,
                // Food
                nutrition: item.nutrition,
              };
            });
          }
          resolve(whitelistedResponseData);
        })
        .catch(error => {
          // console.log({ error });
          reject(error);
        });
    });
  }

  trackMetricPromise({ metric }) {
    const method = "get";
    const url = `/metrics/thisuser/tidepool-${metric}`;
    const baseURL = this.baseUrl;
    const headers = { "x-tidepool-session-token": this.sessionToken };
    let sourceVersion;
    if (Constants.appOwnership === "expo") {
      const systemName = Platform.OS === "ios" ? "iOS" : "Android";
      sourceVersion = `${systemName} ${Constants.manifest.version}`;
    } else {
      sourceVersion = `${DeviceInfo.getSystemName()} ${DeviceInfo.getVersion()} (${DeviceInfo.getBuildNumber()})`;
    }

    const params = {
      source: "tidepool",
      sourceVersion,
    };

    return new Promise((resolve, reject) => {
      axios({ method, url, baseURL, headers, params, timeout })
        .then(() => {
          // console.log(`trackMetricPromise succeeded with metric: ${metric}`);
          resolve();
        })
        .catch(error => {
          // console.log(`trackMetricPromise error: ${error}, with metric: ${metric}`);
          reject(error);
        });
    });
  }
  //
 // Async helpers Notifications
 //

 async saveTokenAsync({token, userId, rol}) {
   if (ConnectionStatus.isOffline) {
     return token;
   }

   this.tasksInProgress += 1;

   const { errorMessage } = await this.saveTokenPromise({token, userId, rol})
     .then(() => ({}))
     .catch(() => ({}));

   this.tasksInProgress -= 1;

   return { errorMessage };
 }

 async signOutAsync({ userId, token }) {
   this.tasksInProgress += 1;
   const { errorMessage } = await this.removeTokenPromise({ userId, token})
     .then(() => ({}))
     .catch(() => ({}));

   this.tasksInProgress -= 1;

   return { errorMessage };
 }

 async readNotificationAsync({noteId, userId}) {

   this.tasksInProgress += 1;

   await this.readNotificationPromise({noteId, userId})
     .then(() => {})
     .catch(() =>{});

   this.tasksInProgress -= 1;
 }


 // Promises Notifications
 saveTokenPromise({ token, userId, rol }) {
   const method = "POST";
   const url = `/token/${userId}`;
   const baseURL = this.baseURLNotifications;
   const data = {rol, token}
   const headers = { 'Accept': 'application/json',
   'Content-Type': 'application/json'}
   return new Promise((resolve, reject) => {
     axios({ method, url, headers, baseURL, data, timeout })
       .then(() => {
         resolve();
       })
       .catch(() => {
         reject();
       });
   });
 }

 // Remove Token
 removeTokenPromise({ userId, token }) {
   const method = "DELETE";
   const url = `/token/${userId}`;
   const baseURL = this.baseURLNotifications;
   const data = {token}
   const headers = { 'Accept': 'application/json',
   'Content-Type': 'application/json'}

   return new Promise((resolve, reject) => {

     axios({ method, url, baseURL, headers, data, timeout })
       .then(() => {
           resolve();
       })
       .catch(() => {
           reject();
       });
   });
 }

 // SAVE Notification

 saveNotificationPromise(data) {
   const method = "POST";
   const url = `/notification/${data.id}`;
   const baseURL = this.baseURLNotifications;
   const headers = { 'Accept': 'application/json',
   'Content-Type': 'application/json'}


   return new Promise((resolve, reject) => {
     if (data.senderId === data.id) {
       Alert.alert(
         "Notificación ClouDi",
         "Estas checheando tus propios datos. Si deseas revisar los de otra persona, da clic en cambiar perfil.",
         [{ text: "OK" }]
       );
       resolve({ok: true});
       return;
     }

     axios({ method, url, baseURL, data, headers, timeout })
       .then(response => {
         const status = !!(response)
         resolve({status});
       })
       .catch(() => {
         reject();
       });
   });
 }

 readNotificationPromise(data) {
   const method = "post";
   const url = `/user-notified/${data.userId}`;
   const baseURL = this.baseURLNotifications;

   return new Promise((resolve, reject) => {
     axios({ method, url, baseURL, data, timeout })
       .then(response => {
         const status = !!(response.data)
         resolve({status});
       })
       .catch(() => {
         reject();
       });
   });
 }

 fetchProfileUsersPromise({ userId }) {
   const method = "get";
   const url = `/metadata/users/${userId}/users`;
   const baseURL = this.baseUrl;
   const headers = { "x-tidepool-session-token": this.sessionToken };
   return new Promise((resolve, reject) => {
     axios({ method, url, baseURL, headers, timeout })
       .then((response) => {
         if (response.data) {
           resolve({ clinics: response.data });
         }
       })
       .catch(error => {
         reject(error);
       });
   });
 }

 async fetchNotificationsAsync({ userId }) {

   this.tasksInProgress += 1;

   let notifications = []

   await this.fetchNotificationsUsersPromise({ userId })
     .then(response => {
       notifications = response.notes;
     }).catch(() => {})

   this.tasksInProgress -= 1;

   return {notifications}
 }

 fetchNotificationsUsersPromise({ userId }) {
   const method = "get";
   const url = `/unread-notifications/${userId}`;
   const baseURL = this.baseURLNotifications;

   return new Promise((resolve, reject) => {
     axios({ method, url, baseURL, timeout })
       .then((response) => {
         let notes = []

         if (response.data && response.data.notes)
           ({ notes } = response.data);

         resolve({notes})
       })
       .catch(error => {
         reject(error);
       });
   });
 }
}

export { TidepoolApi };
