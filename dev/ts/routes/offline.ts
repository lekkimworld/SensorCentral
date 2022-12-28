export default (elemRoot: JQuery<HTMLElement>) => {
    elemRoot.html(`<h1>Offline</h1>
    <p>
    The requested operation cannot be performed while offline.
    </p>`);
};