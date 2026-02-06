import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Tippy from "@tippyjs/react";
import toast from "react-hot-toast";

import ScolioVisDocument from "../ScolioVisDocument";

//#region Animations
import { motion } from "framer-motion";
import {
  exportItemTextVariants,
  exportItemVariants,
} from "@/animations/exportAnimationVariants";
//#endregion

//#region Icons
import { TiExport as ExportIcon } from "react-icons/ti";
import {
  BsFileEarmarkImage as ImageIcon,
  BsFileEarmarkPdfFill as PDFIcon,
} from "react-icons/bs";
import { AiOutlineFileJpg as JPGIcon } from "react-icons/ai";
import { MdPrint as PrintIcon } from "react-icons/md";
import { pdf } from "@react-pdf/renderer";
import useForceUpdate from "@/hooks/useForceUpdate";
import { useStore } from "store";
import { debounce } from "lodash";
//#endregion

//#region Types
type ExportTag = "PDF" | "JPG" | "PNG" | "Print";
type ExportItem = {
  exportTag: ExportTag;
  onClick?: () => void;
};
const EXPORT_ICONS: { [Property in ExportTag]: JSX.Element } = {
  JPG: <JPGIcon size="1.2rem" />,
  PDF: <PDFIcon size="1.2rem" />,
  PNG: <ImageIcon size="1.2rem" />,
  Print: <PrintIcon size="1.2rem" />,
};
interface IExportPopoverProps {
  // exportItems?: ExportItem[];
}
//#endregion Types

const ExportPopover: React.FC<IExportPopoverProps> = ({}) => {
  const [toastId, setToastId] = useState<string>("");
  const PDF_TOASTID = "PDF_TOAST";

  // canvasURL kept for preview/other uses
  const [canvasURL, setCanvasURL] = useState<string>(
    "http://localhost:3000/example_images/1.jpg"
  );
  const scolioVisAPIResponse = useStore((state) => state.scoliovisAPIResponse);
  const drawSettings = useStore((state) => state.drawSettings);

  // Keep track of the current object URL so we can revoke it and avoid leaks
  const currentCanvasObjectURLRef = useRef<string | null>(null);

  // Prevent multiple concurrent PDF generations
  const isGeneratingRef = useRef<boolean>(false);

  // refetchCanvasURL: returns freshly-produced URL (blob: or data:)
  const refetchCanvasURL = useCallback(async (): Promise<string | null> => {
    const canvas = document.getElementById("image-canvas") as HTMLCanvasElement | null;
    if (!canvas) {
      console.warn("refetchCanvasURL: canvas with id 'image-canvas' not found.");
      return null;
    }

    // Revoke previous if exists
    if (currentCanvasObjectURLRef.current) {
      try {
        URL.revokeObjectURL(currentCanvasObjectURLRef.current);
      } catch {}
      currentCanvasObjectURLRef.current = null;
    }

    return await new Promise<string | null>((resolve) => {
      try {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              currentCanvasObjectURLRef.current = url;
              setCanvasURL(url);
              resolve(url);
            } else {
              try {
                const data = canvas.toDataURL("image/png", 1);
                setCanvasURL(data);
                resolve(data);
              } catch (err) {
                console.error("refetchCanvasURL: failed to get image from canvas", err);
                resolve(null);
              }
            }
          },
          "image/png",
          1
        );
      } catch (err) {
        // fallback
        setTimeout(() => {
          try {
            const data = canvas.toDataURL("image/png", 1);
            setCanvasURL(data);
            resolve(data);
          } catch (e) {
            console.error("refetchCanvasURL fallback failed", e);
            resolve(null);
          }
        }, 50);
      }
    });
  }, []);

  // Debounced refetch (kept for other UI flows)
  const refetchCanvasURLDebounced = useMemo(() => {
    const fn = debounce(() => {
      refetchCanvasURL();
    }, 120);
    return fn;
  }, [refetchCanvasURL]);

  useEffect(() => {
    // Do not auto-generate PDF on mount/upload
    // cleanup on unmount
    return () => {
      if (currentCanvasObjectURLRef.current) {
        try {
          URL.revokeObjectURL(currentCanvasObjectURLRef.current);
        } catch {}
        currentCanvasObjectURLRef.current = null;
      }
      refetchCanvasURLDebounced.cancel();
    };
  }, [refetchCanvasURLDebounced]);

  // When draw settings change, cancel any available pdf flag
  useEffect(() => {
    // no automatic downloads
  }, [drawSettings]);

  //#region Helpers
  async function downloadingPromise(ms?: number) {
    await new Promise((resolve) => setTimeout(resolve, ms || 600));
  }

  function downloadURL(url: string, filename?: string) {
    const link = document.createElement("a");
    link.href = url;
    if (filename) link.download = filename;
    link.target = "_blank";
    link.click();
  }
  //#endregion

  const exportItems: ExportItem[] = [
    {
      exportTag: "JPG",
      onClick: () => {
        const canvas = document.getElementById("image-canvas") as HTMLCanvasElement | null;
        if (!canvas) {
          toast.error("Canvas not found.");
          return;
        }
        const date = new Date();
        const monthDay = date
          .toLocaleString("en-us", { month: "long", day: "numeric" })
          .replaceAll(" ", "");
        const time = date
          .toLocaleTimeString("en-us", { hour12: false, hour: "numeric", minute: "numeric" })
          .replaceAll(":", "");
        const imageLink = document.createElement("a");
        imageLink.download = `ScolioVisResult_${monthDay}_${time}.jpeg`;
        imageLink.href = canvas.toDataURL("image/jpeg", 1);
        imageLink.click();
      },
    },
    {
      exportTag: "PNG",
      onClick: () => {
        const canvas = document.getElementById("image-canvas") as HTMLCanvasElement | null;
        if (!canvas) {
          toast.error("Canvas not found.");
          return;
        }
        const date = new Date();
        const monthDay = date
          .toLocaleString("en-us", { month: "long", day: "numeric" })
          .replaceAll(" ", "");
        const time = date
          .toLocaleTimeString("en-us", { hour12: false, hour: "numeric", minute: "numeric" })
          .replaceAll(":", "");
        const imageLink = document.createElement("a");
        imageLink.download = `ScolioVisResult_${monthDay}_${time}.png`;
        imageLink.href = canvas.toDataURL("image/png", 1);
        imageLink.click();
      },
    },
  ];

  return (
    <>
      <Tippy
        appendTo={document.body}
        interactive={true}
        theme="transparent"
        trigger="click"
        animation="shift-away-subtle"
        placement="left"
        duration={100}
        popperOptions={{
          modifiers: [
            {
              name: "flip",
              options: {
                fallbackPlacements: ["left", "right", "bottom"],
              },
            },
          ],
        }}
        offset={[0, 20]}
        content={
          <div className="relative z-20 shadow rounded-full bg-white text-primary h-12 flex items-center gap-x-5 px-5 border">
            <button
              className="flex items-center gap-x-3"
              onClick={async () => {
                // prevent concurrent runs
                if (isGeneratingRef.current) return;
                isGeneratingRef.current = true;

                setToastId(toast.loading("Generating PDF...", { id: PDF_TOASTID }));

                // cancel any pending debounce
                refetchCanvasURLDebounced.cancel();

                // produce fresh canvas image
                const imgSrc = (await refetchCanvasURL()) || canvasURL;
                if (!imgSrc) {
                  toast.error("Failed to read canvas image.");
                  toast.remove(toastId);
                  isGeneratingRef.current = false;
                  return;
                }

                try {
                  // create document with fresh image
                  const doc = (
                    <ScolioVisDocument
                      imageSrc={imgSrc}
                      scolioVisAPIResponse={scolioVisAPIResponse}
                    />
                  );

                  // generate blob (single call)
                  const blob: Blob = await pdf(doc).toBlob();

                  // create downloadable url and download once
                  const blobUrl = URL.createObjectURL(blob);
                  const date = new Date();
                  const monthDay = date
                    .toLocaleString("en-us", { month: "long", day: "numeric" })
                    .replaceAll(" ", "");
                  const time = date
                    .toLocaleTimeString("en-us", { hour12: false, hour: "numeric", minute: "numeric" })
                    .replaceAll(":", "");
                  const filename = `ScolioVisResult_${monthDay}_${time}.pdf`;

                  downloadURL(blobUrl, filename);

                  // cleanup: revoke after short delay
                  setTimeout(() => {
                    try {
                      URL.revokeObjectURL(blobUrl);
                    } catch {}
                  }, 1500);

                  toast.success("Generated PDF Successfully!", { id: PDF_TOASTID });
                } catch (err) {
                  console.error("PDF generation failed", err);
                  toast.error("Failed to generate PDF", { id: PDF_TOASTID });
                } finally {
                  isGeneratingRef.current = false;
                }
              }}
            >
              <PDFIcon />
              <span className="ml-2">PDF</span>
            </button>

            {exportItems.map((eI, i) => (
              <button key={i} onClick={eI.onClick} className="flex items-center gap-x-2">
                {EXPORT_ICONS[eI.exportTag]}
                <span className="ml-1">{eI.exportTag}</span>
              </button>
            ))}
          </div>
        }
      >
        {/* Export Button */}
        <button className="rounded-lg bg-primary text-white px-5 h-12 flex items-center gap-x-3 text-sm font-semibold">
          <ExportIcon size="1.2rem" />
          <span>Export</span>
        </button>
      </Tippy>
    </>
  );
};

export default ExportPopover;
