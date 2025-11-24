declare module 'dom-to-image-more' {
    interface Options {
        quality?: number;
        bgcolor?: string;
        width?: number;
        height?: number;
        style?: any;
        filter?: (node: Node) => boolean;
    }

    export default {
        toPng: (node: Node, options?: Options) => Promise<string>,
        toSvg: (node: Node, options?: Options) => Promise<string>,
        toBlob: (node: Node, options?: Options) => Promise<Blob>,
        toJpeg: (node: Node, options?: Options) => Promise<string>,
    };
}
