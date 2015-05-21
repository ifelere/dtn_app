cd platforms/android/ant-build

rm TKR-v1.1.pk

jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore "C:/Users/IFELERE/AndroidKeys/ifraytech.keystore" -storepass Des2Mee MainActivity-release-unsigned.apk ifraytech

"C:/Users/IFELERE/AppData/Local/Android/android-studio/sdk/build-tools/21.1.2/zipalign" -v 4 MainActivity-release-unsigned.apk TKR-v1.1.apk


cd ../../../
