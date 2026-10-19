// Киллер-фича «Место встречи» для других зон. Leaflet здесь не импортируется: он грузится лениво
// внутри MapPicker и EventsMap, поэтому импорт отсюда не утяжеляет страницу.
export { EventsMap, type EventsMapProps } from './EventsMap';
export { MapPicker, type MapPickerProps, type PlaceValue } from './MapPicker';
export { venueCardData } from './venueCardData';
