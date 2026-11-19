// Unit tests must replace these ports explicitly; this fixture is never imported by the app.
const unavailable = () => { throw new Error('Mock the Expo Router ports for this Node unit test'); };
export const router = { dismissTo: unavailable, back: unavailable, replace: unavailable, canGoBack: unavailable };
export const useLocalSearchParams = unavailable;
