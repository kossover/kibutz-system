import { useState, useRef, useEffect } from 'react';
import { db, auth } from '../../firebase/config';
import { collection, addDoc, serverTimestamp, onSnapshot, query, where, doc, updateDoc, deleteDoc, writeBatch, getDocs } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import app from '../../firebase/config';
import JSZip from 'jszip';
import {
    Images,
    Scissors,
    Trash,
    CloudArrowUp,
    Spinner,
    ArrowCounterClockwise,
    ArrowClockwise,
    CaretRight,
    CaretLeft,
    FloppyDisk,
    FileZip,
    FolderPlus,
    MagicWand,
    BookOpen,
    Eye,
    Globe,
    PencilSimple,
    LockKey
} from '@phosphor-icons/react';

const storage = getStorage(app);

function ManageAlbumDigitizer() {
    const [view, setView] = useState('dashboard'); // 'dashboard', 'create', 'edit'
    const [albums, setAlbums] = useState([]);
    const [activeAlbum, setActiveAlbum] = useState(null);
    const [crops, setCrops] = useState([]);
    const [pendingCrops, setPendingCrops] = useState([]);

    // Create Album states
    const [newAlbumData, setNewAlbumData] = useState({ title: '', description: '', year: '' });
    const [pendingPages, setPendingPages] = useState([]); // Base64 strings
    const [isLocalLoading, setIsLocalLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });

    const fileInputRef = useRef(null);
    const folderInputRef = useRef(null);
    const zipInputRef = useRef(null);

    // Edit Album states
    const [currentPageIndex, setCurrentPageIndex] = useState(0);
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });
    const [isSlicing, setIsSlicing] = useState(false);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiSensitivity, setAiSensitivity] = useState(70);
    const [interactingCrop, setInteractingCrop] = useState(null);
    const [isImageLoaded, setIsImageLoaded] = useState(false);
    const [showAllCrops, setShowAllCrops] = useState(false);
    const [showUntreatedOnly, setShowUntreatedOnly] = useState(false);
    const imgRef = useRef(null);
    const containerRef = useRef(null);
    const pagesScrollRef = useRef(null);

    // Auto-scroll horizontal pages container to the active page
    useEffect(() => {
        if (pagesScrollRef.current) {
            const btn = pagesScrollRef.current.children[currentPageIndex];
            if (btn) {
                btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }
    }, [currentPageIndex]);

    // Reset image loaded state when page changes
    useEffect(() => {
        setIsImageLoaded(false);
    }, [currentPageIndex, activeAlbum?.id]);

    // Fetch Albums
    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'albums'), (snap) => {
            const data = [];
            snap.forEach(d => data.push({ id: d.id, ...d.data() }));
            setAlbums(data.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));

            // Auto-heal missing treatedPages for older albums
            data.forEach(album => {
                if (album.treatedPages === undefined && album.cropsCount > 0) {
                    getDocs(query(collection(db, 'archive_items'), where('albumId', '==', album.id)))
                        .then(cropSnap => {
                            const uniquePages = [...new Set(cropSnap.docs.map(doc => doc.data().pageIndex).filter(p => p !== undefined))];
                            updateDoc(doc(db, 'albums', album.id), { treatedPages: uniquePages }).catch(console.error);
                        })
                        .catch(console.error);
                }
            });
        });
        return () => unsub();
    }, []);

    // Fetch crops for active album
    useEffect(() => {
        if (!activeAlbum) return;
        const unsub = onSnapshot(query(collection(db, 'archive_items'), where('albumId', '==', activeAlbum.id)), (snap) => {
            const data = [];
            snap.forEach(d => data.push({ id: d.id, ...d.data() }));
            // sort by creation
            setCrops(data.sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0)));
        });
        return () => unsub();
    }, [activeAlbum]);


    // ================= DRAFT & PUBLISH =================

    const handlePublishAlbum = async (album) => {
        if (!window.confirm(`האם אתה בטוח שברצונך לפרסם את "${album.title}" לארכיון הציבורי?\nכל התמונות שנחתכו יוצגו למשתמשים.`)) return;

        try {
            // update album
            await updateDoc(doc(db, 'albums', album.id), { status: 'published' });

            // update crops in archive
            const q = query(collection(db, 'archive_items'), where('albumId', '==', album.id));
            const snap = await getDocs(q);
            const batch = writeBatch(db);
            snap.forEach(d => {
                batch.update(d.ref, { status: 'published' });
            });
            await batch.commit();
            alert('האלבום פורסם בהצלחה!');
            if (activeAlbum && activeAlbum.id === album.id) setActiveAlbum(prev => ({ ...prev, status: 'published' }));
        } catch (err) {
            console.error(err);
            alert('שגיאה בפרסום האלבום.');
        }
    };

    const handleDraftAlbum = async (album) => {
        if (!window.confirm(`האם ברצונך להחזיר את האלבום מפורסם לטיוטה?\nזה יסתיר את כל תמונות האלבום מהארכיון הציבורי מידית.`)) return;

        try {
            // update album
            await updateDoc(doc(db, 'albums', album.id), { status: 'draft' });

            // update crops in archive
            const q = query(collection(db, 'archive_items'), where('albumId', '==', album.id));
            const snap = await getDocs(q);
            const batch = writeBatch(db);
            snap.forEach(d => {
                batch.update(d.ref, { status: 'draft' });
            });
            await batch.commit();
            alert('האלבום הוחזר לטיוטה ולא יוצג יותר בארכיון!');
            if (activeAlbum && activeAlbum.id === album.id) setActiveAlbum(prev => ({ ...prev, status: 'draft' }));
        } catch (err) {
            console.error(err);
            alert('שגיאה בהחזרת האלבום לטיוטה.');
        }
    };

    const handleDeleteAlbum = async (album) => {
        if (!window.confirm('מחיקת האלבום תמחוק לחלוטין את כל התמונות שנגזרו ממנו. למחוק?')) return;
        try {
            await deleteDoc(doc(db, 'albums', album.id));
            const q = query(collection(db, 'archive_items'), where('albumId', '==', album.id));
            const snap = await getDocs(q);
            const batch = writeBatch(db);
            snap.forEach(d => batch.delete(d.ref));
            await batch.commit();
        } catch (err) {
            console.error(err);
            alert('שגיאה במחיקה.');
        }
    };

    // ================= FILE UPLOADS =================

    const processImageFiles = (filesList) => {
        const imageFiles = filesList.filter(f => f.type && f.type.startsWith('image/'));
        if (imageFiles.length > 0) {
            setIsLocalLoading(true);
            const readers = imageFiles.map(file => {
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (rev) => resolve(rev.target.result);
                    reader.readAsDataURL(file);
                });
            });
            Promise.all(readers).then(results => {
                setPendingPages(prev => [...prev, ...results]);
                setIsLocalLoading(false);
            });
        }
    };

    const handleFileChange = (e) => {
        processImageFiles(Array.from(e.target.files));
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleFolderChange = (e) => {
        processImageFiles(Array.from(e.target.files));
        if (folderInputRef.current) folderInputRef.current.value = '';
    };

    const handleZipUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setIsLocalLoading(true);
        try {
            const jszip = new JSZip();
            const zip = await jszip.loadAsync(file);
            const imagePromises = [];
            zip.forEach((relativePath, zipEntry) => {
                if (!zipEntry.dir && !relativePath.includes('__MACOSX') && relativePath.match(/\.(jpeg|jpg|png|gif)$/i)) {
                    imagePromises.push(
                        zipEntry.async('base64').then(base64 => {
                            const ext = relativePath.split('.').pop().toLowerCase();
                            const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
                            return `data:${mime};base64,${base64}`;
                        })
                    );
                }
            });
            const results = await Promise.all(imagePromises);
            setPendingPages(prev => [...prev, ...results]);
        } catch (err) {
            console.error(err);
            alert('שגיאה בחילוץ ZIP.');
        } finally {
            setIsLocalLoading(false);
            if (zipInputRef.current) zipInputRef.current.value = '';
        }
    };

    const handleCreateAlbumSubmit = async () => {
        if (!newAlbumData.title) return alert('חובה להזין כותרת לאלבום');
        if (pendingPages.length === 0) return alert('חובה להעלות לפחות דף אחד לאלבום');

        setIsUploading(true);
        try {
            const pageUrls = [];
            for (let i = 0; i < pendingPages.length; i++) {
                const storageRef = ref(storage, `archive/album_base_pages/page_${Date.now()}_${i}.jpg`);
                await uploadString(storageRef, pendingPages[i], 'data_url');
                const downloadUrl = await getDownloadURL(storageRef);
                pageUrls.push({ id: `p_${i}`, url: downloadUrl });
                setUploadProgress({ current: i + 1, total: pendingPages.length });
            }

            const albumData = {
                title: newAlbumData.title,
                description: newAlbumData.description,
                year: newAlbumData.year,
                pages: pageUrls,
                status: 'draft',
                cropsCount: 0,
                createdAt: serverTimestamp(),
                uploadedBy: auth?.currentUser?.uid || 'admin'
            };

            const docRef = await addDoc(collection(db, 'albums'), albumData);
            setNewAlbumData({ title: '', description: '', year: '' });
            setPendingPages([]);
            setView('dashboard');

            // Auto open the new album
            const newAlbumSnap = await doc(db, 'albums', docRef.id);
            setActiveAlbum({ id: docRef.id, ...albumData });
            setCurrentPageIndex(0);
            setView('edit');

        } catch (err) {
            console.error(err);
            alert('שגיאה ביצירת האלבום: ' + err.message);
        } finally {
            setIsUploading(false);
        }
    };


    // ================= DRAWING & SLICING =================

    const handleCropInteractStart = (e, crop, type) => {
        e.stopPropagation();
        e.preventDefault();
        const rect = imgRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setInteractingCrop({
            id: crop.id,
            isLocal: !!crop.isLocal,
            type,
            startBox: { ...crop.visualBox },
            startMouse: { x, y }
        });
    };

    const handleMouseDown = (e) => {
        e.preventDefault();
        const rect = imgRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setIsDrawing(true);
        setStartPos({ x, y });
        setCurrentPos({ x, y });
    };

    const handleMouseMove = (e) => {
        const rect = imgRef.current.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;

        if (x < 0) x = 0;
        if (y < 0) y = 0;
        if (x > rect.width) x = rect.width;
        if (y > rect.height) y = rect.height;

        if (interactingCrop) {
            const dx = x - interactingCrop.startMouse.x;
            const dy = y - interactingCrop.startMouse.y;
            let newBox = { ...interactingCrop.startBox };

            if (interactingCrop.type === 'move') {
                newBox.x += dx;
                newBox.y += dy;
            } else {
                if (interactingCrop.type.includes('n')) {
                    newBox.y += dy;
                    newBox.height -= dy;
                }
                if (interactingCrop.type.includes('s')) {
                    newBox.height += dy;
                }
                if (interactingCrop.type.includes('w')) {
                    newBox.x += dx;
                    newBox.width -= dx;
                }
                if (interactingCrop.type.includes('e')) {
                    newBox.width += dx;
                }
            }

            if (newBox.width < 10) {
                if (interactingCrop.type.includes('w')) newBox.x += interactingCrop.startBox.width - 10;
                newBox.width = 10;
            }
            if (newBox.height < 10) {
                if (interactingCrop.type.includes('n')) newBox.y += interactingCrop.startBox.height - 10;
                newBox.height = 10;
            }

            if (newBox.x < 0) newBox.x = 0;
            if (newBox.y < 0) newBox.y = 0;
            if (newBox.x + newBox.width > rect.width) newBox.x = rect.width - newBox.width;
            if (newBox.y + newBox.height > rect.height) newBox.y = rect.height - newBox.height;

            if (interactingCrop.isLocal) {
                setPendingCrops(prev => prev.map(c => c.id === interactingCrop.id ? { ...c, visualBox: newBox } : c));
            } else {
                setCrops(prev => prev.map(c => c.id === interactingCrop.id ? { ...c, visualBox: newBox } : c));
            }
            return;
        }

        if (!isDrawing) return;
        setCurrentPos({ x, y });
    };

    const handleMouseUp = async () => {
        if (interactingCrop) {
            const cropId = interactingCrop.id;
            const isLocal = interactingCrop.isLocal;
            const cropList = isLocal ? pendingCrops : crops;
            const updatedCrop = cropList.find(c => c.id === cropId);
            setInteractingCrop(null);

            // Redraw canvas if changed
            if (updatedCrop && (updatedCrop.visualBox.width !== interactingCrop.startBox.width || updatedCrop.visualBox.height !== interactingCrop.startBox.height || updatedCrop.visualBox.x !== interactingCrop.startBox.x || updatedCrop.visualBox.y !== interactingCrop.startBox.y)) {
                setIsSlicing(true);
                setTimeout(async () => {
                    try {
                        const imgEl = imgRef.current;
                        const scaleX = imgEl.naturalWidth / imgEl.clientWidth;
                        const scaleY = imgEl.naturalHeight / imgEl.clientHeight;

                        const cropX = updatedCrop.visualBox.x;
                        const cropY = updatedCrop.visualBox.y;
                        const cropW = updatedCrop.visualBox.width;
                        const cropH = updatedCrop.visualBox.height;

                        const realX = cropX * scaleX;
                        const realY = cropY * scaleY;
                        const realW = cropW * scaleX;
                        const realH = cropH * scaleY;

                        const maxDimension = 1600;
                        let finalW = realW;
                        let finalH = realH;
                        if (finalW > maxDimension || finalH > maxDimension) {
                            const ratio = Math.min(maxDimension / finalW, maxDimension / finalH);
                            finalW = Math.floor(finalW * ratio);
                            finalH = Math.floor(finalH * ratio);
                        }

                        const canvas = document.createElement('canvas');
                        canvas.width = finalW;
                        canvas.height = finalH;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(imgEl, realX, realY, realW, realH, 0, 0, finalW, finalH);
                        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

                        if (isLocal) {
                            setPendingCrops(prev => prev.map(c => c.id === cropId ? { ...c, mediaUrl: dataUrl } : c));
                        } else {
                            const storageRef = ref(storage, `archive/album_scans/sliced_mod_${Date.now()}.jpg`);
                            await uploadString(storageRef, dataUrl, 'data_url');
                            const downloadUrl = await getDownloadURL(storageRef);
                            await updateDoc(doc(db, 'archive_items', cropId), {
                                mediaUrl: downloadUrl,
                                visualBox: updatedCrop.visualBox
                            });
                            setCrops(prev => prev.map(c => c.id === cropId ? { ...c, mediaUrl: downloadUrl } : c));
                        }
                    } catch (e) {
                        console.error(e);
                    } finally {
                        setIsSlicing(false);
                    }
                }, 10);
            }
            return;
        }

        if (!isDrawing) return;
        setIsDrawing(false);

        const imgEl = imgRef.current;
        if (!imgEl) return;

        const cropX = Math.min(startPos.x, currentPos.x);
        const cropY = Math.min(startPos.y, currentPos.y);
        const cropW = Math.abs(currentPos.x - startPos.x);
        const cropH = Math.abs(currentPos.y - startPos.y);

        if (cropW < 20 || cropH < 20) return;

        setIsSlicing(true);
        setTimeout(() => {
            try {
                const scaleX = imgEl.naturalWidth / imgEl.clientWidth;
                const scaleY = imgEl.naturalHeight / imgEl.clientHeight;

                const realX = cropX * scaleX;
                const realY = cropY * scaleY;
                const realW = cropW * scaleX;
                const realH = cropH * scaleY;

                const maxDimension = 1600;
                let finalW = realW;
                let finalH = realH;
                if (finalW > maxDimension || finalH > maxDimension) {
                    const ratio = Math.min(maxDimension / finalW, maxDimension / finalH);
                    finalW = Math.floor(finalW * ratio);
                    finalH = Math.floor(finalH * ratio);
                }

                const canvas = document.createElement('canvas');
                canvas.width = finalW;
                canvas.height = finalH;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(imgEl, realX, realY, realW, realH, 0, 0, finalW, finalH);

                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

                const baseTitle = activeAlbum.title ? `${activeAlbum.title} - ${crops.length + pendingCrops.length + 1}` : '';

                const localCrop = {
                    id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                    isLocal: true,
                    title: baseTitle,
                    description: activeAlbum.description || '',
                    year: activeAlbum.year || '',
                    type: 'image',
                    mediaUrl: dataUrl,
                    status: activeAlbum.status,
                    albumId: activeAlbum.id,
                    pageIndex: currentPageIndex,
                    visualBox: { x: cropX, y: cropY, width: cropW, height: cropH },
                    categories: ['אלבומים'],
                    tags: ['פיצול אלבום']
                };

                setPendingCrops(prev => [...prev, localCrop]);
            } catch (e) {
                console.error(e);
                alert('שגיאה בשמירת החיתוך');
            } finally {
                setIsSlicing(false);
            }
        }, 10);
    };


    const handleAutoDetect = () => {
        const imgEl = imgRef.current;
        if (!imgEl) return;
        setIsAiLoading(true);

        setTimeout(async () => {
            try {
                const canvas = document.createElement('canvas');
                const procWidth = 300;
                const scale = procWidth / imgEl.naturalWidth;
                const procHeight = Math.floor(imgEl.naturalHeight * scale);

                canvas.width = procWidth;
                canvas.height = procHeight;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.filter = 'blur(2px) contrast(150%)';
                ctx.drawImage(imgEl, 0, 0, procWidth, procHeight);

                const imgData = ctx.getImageData(0, 0, procWidth, procHeight);
                const data = imgData.data;
                // Find dominant colors to represent the physical album page background
                // instead of sampling just one color, which fails on striped/textured pages.
                const colorBuckets = {};
                let borderTotal = 0;

                // Sample pixels only from an internal "frame" of the image
                // (e.g., between 3% and 15% distance from the edge) 
                // to skip both the outer table/binder and the center photos.
                for (let y = 0; y < procHeight; y += 2) {
                    for (let x = 0; x < procWidth; x += 2) {
                        const xPct = x / procWidth;
                        const yPct = y / procHeight;

                        // We want to skip the extreme edges which contain tables, binders, and plastic sleeves.
                        // We sample the broad center of the image (15% to 85%).
                        // Since photos naturally contain a huge variety of chaotic colors, the uniform album paper
                        // will create the tallest peak (most frequent color) in our color histogram.
                        const isInnerArea = (xPct >= 0.15 && xPct <= 0.85 && yPct >= 0.15 && yPct <= 0.85);

                        if (isInnerArea) {
                            borderTotal++;
                            const i = (y * procWidth + x) * 4;
                            const r = data[i];
                            const g = data[i + 1];
                            const b = data[i + 2];

                            // Quantize colors to group similar shades (e.g., variations of brown)
                            const qR = Math.floor(r / 32);
                            const qG = Math.floor(g / 32);
                            const qB = Math.floor(b / 32);
                            const key = `${qR},${qG},${qB}`;

                            if (!colorBuckets[key]) colorBuckets[key] = { count: 0, r: 0, g: 0, b: 0 };
                            colorBuckets[key].count++;
                            colorBuckets[key].r += r;
                            colorBuckets[key].g += g;
                            colorBuckets[key].b += b;
                        }
                    }
                }

                // Sort buckets by frequency
                const sortedBuckets = Object.values(colorBuckets).sort((a, b) => b.count - a.count);

                // Keep top buckets that make up 75% of the frame, up to a max of 6 distinct colors
                const dominantBackgrounds = [];
                let accum = 0;
                for (const b of sortedBuckets) {
                    dominantBackgrounds.push({
                        r: b.r / b.count,
                        g: b.g / b.count,
                        b: b.b / b.count
                    });
                    accum += b.count;
                    // A uniform background will spike rapidly. 
                    // Stop once we gathered the most dominant spikes representing ~40% of the sampled inner area, up to 6 colors.
                    if (accum > borderTotal * 0.40 || dominantBackgrounds.length >= 6) {
                        break;
                    }
                }

                if (dominantBackgrounds.length === 0) {
                    dominantBackgrounds.push({ r: 255, g: 255, b: 255 }); // fallback to white
                }

                console.log("[AutoDetect] Detected Background Colors (Top " + dominantBackgrounds.length + "):", dominantBackgrounds);
                console.log("[AutoDetect] AI Sensitivity:", aiSensitivity);

                const isForeground = (r, g, b) => {
                    let minDiff = 9999;
                    // Check against all background colors and find the closest matching one
                    for (const bg of dominantBackgrounds) {
                        const dist = Math.sqrt(Math.pow(r - bg.r, 2) + Math.pow(g - bg.g, 2) + Math.pow(b - bg.b, 2));
                        if (dist < minDiff) minDiff = dist;
                    }
                    // Adjusted threshold scale based on sensitivity slider.
                    // If sensitivity is 70, threshold is ~44. Max possible dist is ~441.
                    const threshold = 100 - (aiSensitivity * 0.8);
                    return minDiff > threshold;
                };

                let map = new Uint8Array(procWidth * procHeight);
                let foregroundCount = 0;
                for (let y = 0; y < procHeight; y++) {
                    for (let x = 0; x < procWidth; x++) {
                        const i = (y * procWidth + x) * 4;
                        if (isForeground(data[i], data[i + 1], data[i + 2])) {
                            map[y * procWidth + x] = 1;
                            foregroundCount++;
                        }
                    }
                }
                console.log(`[AutoDetect] Foreground pixels found: ${foregroundCount} out of ${procWidth * procHeight} (${((foregroundCount / (procWidth * procHeight)) * 100).toFixed(1)}%)`);

                // Erode foreground to break thin bridges between adjacent touching photos
                for (let pass = 0; pass < 3; pass++) {
                    const eroded = new Uint8Array(procWidth * procHeight);
                    for (let y = 1; y < procHeight - 1; y++) {
                        for (let x = 1; x < procWidth - 1; x++) {
                            const i = y * procWidth + x;
                            if (map[i] === 1 && map[i - 1] === 1 && map[i + 1] === 1 && map[i - procWidth] === 1 && map[i + procWidth] === 1) {
                                eroded[i] = 1;
                            }
                        }
                    }
                    map = eroded;
                }

                const visited = new Uint8Array(procWidth * procHeight);
                const boxes = [];

                for (let y = 0; y < procHeight; y++) {
                    for (let x = 0; x < procWidth; x++) {
                        const idx = y * procWidth + x;
                        if (map[idx] === 1 && visited[idx] === 0) {
                            let minX = x, maxX = x, minY = y, maxY = y;
                            const stack = [idx];
                            visited[idx] = 1;
                            let area = 0;
                            while (stack.length > 0) {
                                const cur = stack.pop();
                                const cy = Math.floor(cur / procWidth);
                                const cx = cur % procWidth;
                                if (cx < minX) minX = cx;
                                if (cx > maxX) maxX = cx;
                                if (cy < minY) minY = cy;
                                if (cy > maxY) maxY = cy;
                                area++;
                                const neighbors = [cur - 1, cur + 1, cur - procWidth, cur + procWidth];
                                for (let i = 0; i < 4; i++) {
                                    const n = neighbors[i];
                                    if (n >= 0 && n < visited.length && map[n] === 1 && visited[n] === 0) {
                                        if (i === 0 && cx === 0) continue;
                                        if (i === 1 && cx === procWidth - 1) continue;
                                        visited[n] = 1;
                                        stack.push(n);
                                    }
                                }
                            }
                            if (maxX - minX > procWidth * 0.10 && maxY - minY > procHeight * 0.10 && area > (procWidth * procHeight * 0.01)) {
                                boxes.push({ minX, maxX, minY, maxY, area });
                            }
                        }
                    }
                }

                console.log(`[AutoDetect] Number of raw boxes identified (before merging): ${boxes.length}`);

                // Merge overlapping or near-intersecting boxes
                const DIST_THRESHOLD = procWidth * 0.035; // Merge if gap is smaller than ~3.5% of width
                let changed = true;
                const mergedBoxes = [...boxes];

                while (changed) {
                    changed = false;
                    for (let i = 0; i < mergedBoxes.length; i++) {
                        for (let j = i + 1; j < mergedBoxes.length; j++) {
                            const b1 = mergedBoxes[i];
                            const b2 = mergedBoxes[j];
                            if (b1.minX - DIST_THRESHOLD < b2.maxX &&
                                b1.maxX + DIST_THRESHOLD > b2.minX &&
                                b1.minY - DIST_THRESHOLD < b2.maxY &&
                                b1.maxY + DIST_THRESHOLD > b2.minY) {

                                // Merge b2 into b1
                                b1.minX = Math.min(b1.minX, b2.minX);
                                b1.maxX = Math.max(b1.maxX, b2.maxX);
                                b1.minY = Math.min(b1.minY, b2.minY);
                                b1.maxY = Math.max(b1.maxY, b2.maxY);
                                mergedBoxes.splice(j, 1);
                                changed = true;
                                break;
                            }
                        }
                        if (changed) break;
                    }
                }

                console.log(`[AutoDetect] Number of final boxes after merging: ${mergedBoxes.length}`, mergedBoxes);

                if (mergedBoxes.length === 0) {
                    alert("לא זוהו תמונות רקע. נסה לחתוך באופן ידני.");
                    setIsAiLoading(false);
                    return;
                }

                // Batch local processing
                const displayScaleX = imgEl.clientWidth / procWidth;
                const displayScaleY = imgEl.clientHeight / procHeight;
                const naturalScaleX = imgEl.naturalWidth / procWidth;
                const naturalScaleY = imgEl.naturalHeight / procHeight;

                const maxDimension = 1600;
                const newCrops = [];

                for (let index = 0; index < mergedBoxes.length; index++) {
                    const box = mergedBoxes[index];
                    // Add padding to compensate for the erosion passes
                    const padX = (box.maxX - box.minX) * 0.04;
                    const padY = (box.maxY - box.minY) * 0.04;
                    const finalMinX = Math.max(0, box.minX - padX);
                    const finalMaxX = Math.min(procWidth, box.maxX + padX);
                    const finalMinY = Math.max(0, box.minY - padY);
                    const finalMaxY = Math.min(procHeight, box.maxY + padY);

                    const cropX = finalMinX * displayScaleX;
                    const cropY = finalMinY * displayScaleY;
                    const cropW = (finalMaxX - finalMinX) * displayScaleX;
                    const cropH = (finalMaxY - finalMinY) * displayScaleY;

                    const realX = finalMinX * naturalScaleX;
                    const realY = finalMinY * naturalScaleY;
                    const realW = (finalMaxX - finalMinX) * naturalScaleX;
                    const realH = (finalMaxY - finalMinY) * naturalScaleY;

                    let finalW = realW;
                    let finalH = realH;
                    if (finalW > maxDimension || finalH > maxDimension) {
                        const ratio = Math.min(maxDimension / finalW, maxDimension / finalH);
                        finalW = Math.floor(finalW * ratio);
                        finalH = Math.floor(finalH * ratio);
                    }

                    const cropCanvas = document.createElement('canvas');
                    cropCanvas.width = finalW;
                    cropCanvas.height = finalH;
                    const cropCtx = cropCanvas.getContext('2d');
                    cropCtx.drawImage(imgEl, realX, realY, realW, realH, 0, 0, finalW, finalH);

                    const dataUrl = cropCanvas.toDataURL('image/jpeg', 0.85);

                    const baseTitle = activeAlbum.title ? `${activeAlbum.title} - ${crops.length + pendingCrops.length + newCrops.length + 1}` : '';

                    newCrops.push({
                        id: `local_${Date.now()}_${index}`,
                        isLocal: true,
                        title: baseTitle,
                        description: activeAlbum.description || '',
                        year: activeAlbum.year || '',
                        type: 'image',
                        mediaUrl: dataUrl,
                        status: activeAlbum.status,
                        albumId: activeAlbum.id,
                        pageIndex: currentPageIndex,
                        visualBox: { x: cropX, y: cropY, width: cropW, height: cropH },
                        categories: ['אלבומים'],
                        tags: ['פיצול אלבום']
                    });
                }

                setPendingCrops(prev => [...prev, ...newCrops]);

            } catch (e) {
                console.error(e);
                alert("משהו השתבש בזיהוי האוטומטי.");
            } finally {
                setIsAiLoading(false);
            }
        }, 100);
    };

    const handleRemoveCrop = async (id) => {
        if (id.startsWith('local_')) {
            setPendingCrops(prev => prev.filter(c => c.id !== id));
            return;
        }
        try {
            await deleteDoc(doc(db, 'archive_items', id));
            const newCount = Math.max(0, (activeAlbum.cropsCount || 1) - 1);

            const cropToRemove = crops.find(c => c.id === id);
            let updatedTreatedPages = activeAlbum.treatedPages || [];
            if (cropToRemove) {
                const remainingOnPage = crops.filter(c => c.pageIndex === cropToRemove.pageIndex && c.id !== id);
                if (remainingOnPage.length === 0) {
                    updatedTreatedPages = updatedTreatedPages.filter(pIndex => pIndex !== cropToRemove.pageIndex);
                }
            }

            await updateDoc(doc(db, 'albums', activeAlbum.id), { cropsCount: newCount, treatedPages: updatedTreatedPages });
            setActiveAlbum(prev => ({ ...prev, cropsCount: newCount, treatedPages: updatedTreatedPages }));
        } catch (e) { console.error(e); }
    };

    const handleUpdateCropField = async (id, field, value) => {
        if (id.startsWith('local_')) {
            setPendingCrops(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
            return;
        }
        try {
            await updateDoc(doc(db, 'archive_items', id), { [field]: value });
        } catch (e) { console.error(e); }
    };

    const handleRotateCrop = async (crop, direction) => {
        try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = async () => {
                const canvas = document.createElement('canvas');
                if (direction === 'CW' || direction === 'CCW') {
                    canvas.width = img.height;
                    canvas.height = img.width;
                } else {
                    canvas.width = img.width;
                    canvas.height = img.height;
                }

                const ctx = canvas.getContext('2d');
                if (direction === 'CW') {
                    ctx.translate(canvas.width, 0);
                    ctx.rotate(Math.PI / 2);
                } else if (direction === 'CCW') {
                    ctx.translate(0, canvas.height);
                    ctx.rotate(-Math.PI / 2);
                }

                ctx.drawImage(img, 0, 0);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

                if (crop.isLocal) {
                    setPendingCrops(prev => prev.map(c => c.id === crop.id ? { ...c, mediaUrl: dataUrl } : c));
                } else {
                    // 1. Optimistic Update (Immediate Feedback to User)
                    setCrops(prev => prev.map(c => c.id === crop.id ? { ...c, mediaUrl: dataUrl } : c));

                    // 2. Background Saving (Non-blocking)
                    (async () => {
                        try {
                            const storageRef = ref(storage, `archive/album_scans/rotated_${Date.now()}.jpg`);
                            await uploadString(storageRef, dataUrl, 'data_url');
                            const downloadUrl = await getDownloadURL(storageRef);

                            await updateDoc(doc(db, 'archive_items', crop.id), { mediaUrl: downloadUrl });
                            // Optional: Update to the actual remote URL after upload
                            setCrops(prev => prev.map(c => c.id === crop.id ? { ...c, mediaUrl: downloadUrl } : c));
                        } catch (err) {
                            console.error("Background rotation upload failed: ", err);
                        }
                    })();
                }
            };
            img.src = crop.mediaUrl;
        } catch (e) {
            console.error(e);
            alert("שגיאה בסיבוב התמונה.");
        }
    };

    const handleUploadPendingCrops = async () => {
        if (pendingCrops.length === 0) return;
        setIsUploading(true);
        setUploadProgress({ current: 0, total: pendingCrops.length });
        let uploaded = 0;
        try {
            for (let i = 0; i < pendingCrops.length; i++) {
                const crop = pendingCrops[i];
                const storageRef = ref(storage, `archive/album_scans/sliced_${Date.now()}_${i}.jpg`);
                await uploadString(storageRef, crop.mediaUrl, 'data_url');
                const downloadUrl = await getDownloadURL(storageRef);

                await addDoc(collection(db, 'archive_items'), {
                    title: crop.title,
                    description: crop.description,
                    year: crop.year,
                    type: crop.type,
                    mediaUrl: downloadUrl,
                    status: crop.status,
                    albumId: crop.albumId,
                    pageIndex: crop.pageIndex,
                    visualBox: crop.visualBox,
                    categories: crop.categories,
                    tags: crop.tags,
                    createdAt: serverTimestamp()
                });
                uploaded++;
                setUploadProgress({ current: uploaded, total: pendingCrops.length });
            }

            const newCount = (activeAlbum.cropsCount || 0) + uploaded;

            const treatedSet = new Set(activeAlbum.treatedPages || []);
            pendingCrops.forEach(c => treatedSet.add(c.pageIndex));
            const updatedTreatedPages = Array.from(treatedSet);

            await updateDoc(doc(db, 'albums', activeAlbum.id), { cropsCount: newCount, treatedPages: updatedTreatedPages });
            setActiveAlbum(prev => ({ ...prev, cropsCount: newCount, treatedPages: updatedTreatedPages }));

            setPendingCrops([]);

            // Find next untreated page
            let nextIndex = currentPageIndex;
            for (let i = currentPageIndex + 1; i < activeAlbum.pages.length; i++) {
                if (!updatedTreatedPages.includes(i)) {
                    nextIndex = i;
                    break;
                }
            }
            // If not found after current, wrap around to start
            if (nextIndex === currentPageIndex) {
                for (let i = 0; i < currentPageIndex; i++) {
                    if (!updatedTreatedPages.includes(i)) {
                        nextIndex = i;
                        break;
                    }
                }
            }
            setCurrentPageIndex(nextIndex);

            // Scroll up smoothly to start working on the new page
            setTimeout(() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }, 300);
        } catch (e) {
            console.error(e);
            alert("שגיאה בהעלאה. הועלו " + uploaded + " מתוך " + pendingCrops.length);
        } finally {
            setIsUploading(false);
        }
    }


    // ================= RENDER DELEGATION =================

    if (view === 'create') {
        return (
            <div>
                <div className="flex-between mb-4 flex-wrap gap-2">
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>יצירת אלבום חדש לפיצול</h2>
                    <button className="btn btn-secondary" onClick={() => setView('dashboard')} style={{ width: 'auto' }}>חזרה לדשבורד</button>
                </div>

                <div className="card mb-4">
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <BookOpen size={24} weight="duotone" /> פרטי האלבום
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                        <div>
                            <label className="form-label" style={{ fontWeight: '600' }}>שם האלבום / כותרת בסיס</label>
                            <input className="form-input" style={{ margin: 0 }} value={newAlbumData.title} onChange={e => setNewAlbumData({ ...newAlbumData, title: e.target.value })} placeholder="לדוגמה: טיול לאילת 1990" />
                        </div>
                        <div>
                            <label className="form-label">תיאור (יוחל על התמונות אוטומטית)</label>
                            <input className="form-input" style={{ margin: 0 }} value={newAlbumData.description} onChange={e => setNewAlbumData({ ...newAlbumData, description: e.target.value })} placeholder="..." />
                        </div>
                        <div>
                            <label className="form-label">שנה</label>
                            <input className="form-input" style={{ margin: 0 }} value={newAlbumData.year} onChange={e => setNewAlbumData({ ...newAlbumData, year: e.target.value })} placeholder="לדוגמה: 1990" />
                        </div>
                    </div>
                </div>

                <div className="card mb-4" style={{ textAlign: 'center' }}>
                    {isLocalLoading || isUploading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: '16px' }}>
                            <Spinner size={32} className="spin" color="#7e22ce" />
                            <span style={{ fontSize: '1.2rem', color: '#64748b', fontWeight: '500' }}>
                                {isUploading ? `מעלה יחידות בסיס לענן (${uploadProgress.current}/${uploadProgress.total})...` : 'קורא ומעבד קבצים...'}
                            </span>
                        </div>
                    ) : (
                        <div style={{ padding: '20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
                                בחר את המקור לסריקות דפי האלבום
                            </p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'center' }}>
                                <div>
                                    <input type="file" accept="image/*" multiple onChange={handleFileChange} style={{ display: 'none' }} ref={fileInputRef} id="album-upload" />
                                    <label htmlFor="album-upload" className="btn" style={{ width: 'auto', display: 'inline-flex', padding: '12px 24px', fontSize: '1.1rem', gap: '8px', background: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)', color: 'white', cursor: 'pointer' }}>
                                        <Images size={24} /> תמונות בודדות
                                    </label>
                                </div>
                                <div>
                                    <input type="file" webkitdirectory="" directory="" onChange={handleFolderChange} style={{ display: 'none' }} ref={folderInputRef} id="album-folder-upload" />
                                    <label htmlFor="album-folder-upload" className="btn btn-secondary" style={{ width: 'auto', display: 'inline-flex', padding: '12px 24px', fontSize: '1.1rem', gap: '8px', cursor: 'pointer' }}>
                                        <FolderPlus size={24} color="#7e22ce" /> תיקיית תמונות
                                    </label>
                                </div>
                                <div>
                                    <input type="file" accept=".zip" onChange={handleZipUpload} style={{ display: 'none' }} ref={zipInputRef} id="album-zip-upload" />
                                    <label htmlFor="album-zip-upload" className="btn btn-secondary" style={{ width: 'auto', display: 'inline-flex', padding: '12px 24px', fontSize: '1.1rem', gap: '8px', cursor: 'pointer' }}>
                                        <FileZip size={24} color="#7e22ce" /> מקובץ ZIP
                                    </label>
                                </div>
                            </div>

                            {pendingPages.length > 0 && (
                                <div style={{ marginTop: '24px', width: '100%', maxWidth: '600px', background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#10b981', marginBottom: '16px' }}>{pendingPages.length} דפים נטענו מוכנים לעבודה</div>
                                    <button className="btn btn-primary" onClick={handleCreateAlbumSubmit} disabled={isUploading} style={{ fontSize: '1.2rem', padding: '14px', borderRadius: '12px', background: '#10b981' }}>
                                        <FloppyDisk size={24} /> התחל לפצל את האלבום!
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (view === 'edit' && activeAlbum) {
        const imageSrc = activeAlbum.pages[currentPageIndex]?.url;
        const allCrops = [...crops, ...pendingCrops];

        return (
            <div>
                {/* Full screen overlay during crop saving */}
                {isUploading && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(5px)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s ease' }}>
                        <Spinner size={64} className="spin" color="#10b981" />
                        <h2 style={{ marginTop: '24px', fontSize: '2rem', color: '#0f172a', fontWeight: 'bold' }}>שומר תמונות...</h2>
                        <div style={{ marginTop: '16px', fontSize: '1.2rem', color: '#10b981', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <CloudArrowUp size={24} /> {uploadProgress.current} מתוך {uploadProgress.total}
                        </div>
                        <p style={{ marginTop: '8px', color: '#64748b' }}>אנא המתן עד לסיום שמירת החיתוכים בענן.</p>
                    </div>
                )}

                <div className="flex-between mb-4 flex-wrap gap-2">
                    <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <BookOpen size={28} color="#7e22ce" /> גיזום: {activeAlbum.title}
                        </h2>
                        <span style={{ fontSize: '0.9rem', color: '#64748b', background: '#f1f5f9', padding: '4px 10px', borderRadius: '99px', marginTop: '4px', display: 'inline-block' }}>
                            סטטוס: {activeAlbum.status === 'published' ? '🟢 מפורסם בארכיון' : '🔴 טיוטה (לא ציבורי)'}
                        </span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        {activeAlbum.status === 'draft' ? (
                            <button className="btn btn-primary" onClick={() => handlePublishAlbum(activeAlbum)} style={{ width: 'auto', background: '#10b981', gap: '8px' }}>
                                <Globe size={20} /> פרסם אלבום לארכיון
                            </button>
                        ) : (
                            <button className="btn btn-secondary" onClick={() => handleDraftAlbum(activeAlbum)} style={{ width: 'auto', color: '#f59e0b', gap: '8px' }}>
                                <LockKey size={20} /> החזר אלבום לטיוטה
                            </button>
                        )}
                        <button className="btn btn-secondary" onClick={() => setView('dashboard')} style={{ width: 'auto' }}>חזרה</button>
                    </div>
                </div>

                <div className="card mb-4" style={{ textAlign: 'center' }}>
                    {activeAlbum.pages.length > 1 && (
                        <div style={{ marginBottom: '24px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <button className="btn btn-secondary" disabled={currentPageIndex === 0} onClick={() => setCurrentPageIndex(p => Math.max(0, p - 1))} style={{ width: 'auto', padding: '6px 12px' }}>
                                        <CaretRight size={18} /> קודם
                                    </button>
                                    <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#1e293b' }}>
                                        דף {currentPageIndex + 1} מתוך {activeAlbum.pages.length}
                                    </span>
                                    <button className="btn btn-secondary" disabled={currentPageIndex === activeAlbum.pages.length - 1} onClick={() => setCurrentPageIndex(p => Math.min(activeAlbum.pages.length - 1, p + 1))} style={{ width: 'auto', padding: '6px 12px' }}>
                                        הבא <CaretLeft size={18} />
                                    </button>
                                </div>

                                <button className="btn btn-secondary" onClick={() => setShowUntreatedOnly(!showUntreatedOnly)} style={{ width: 'auto', padding: '6px 12px', fontSize: '0.9rem', background: showUntreatedOnly ? '#e0e7ff' : 'white', border: showUntreatedOnly ? '1px solid #6366f1' : '1px solid #cbd5e1', color: showUntreatedOnly ? '#4338ca' : '#475569' }}>
                                    {showUntreatedOnly ? 'מציג מחוסרי טיפול בלבד' : 'סנן להצגת מחוסרי טיפול'}
                                </button>
                            </div>

                            <div ref={pagesScrollRef} style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', scrollbarWidth: 'thin' }}>
                                {activeAlbum.pages.map((p, idx) => {
                                    const hasCrops = allCrops.filter(c => c.pageIndex === idx).length;

                                    // Hide if filter is on and page has crops (unless it's the current page)
                                    if (showUntreatedOnly && hasCrops > 0 && currentPageIndex !== idx) return null;

                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => setCurrentPageIndex(idx)}
                                            style={{
                                                flexShrink: 0, padding: '8px 16px', borderRadius: '8px',
                                                background: currentPageIndex === idx ? '#3b82f6' : (hasCrops > 0 ? '#dcfce7' : 'white'),
                                                color: currentPageIndex === idx ? 'white' : '#334155',
                                                border: currentPageIndex === idx ? 'none' : (hasCrops > 0 ? '1px solid #86efac' : '1px solid #cbd5e1'),
                                                cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                                                boxShadow: currentPageIndex === idx ? '0 4px 6px -1px rgba(59, 130, 246, 0.4)' : '0 1px 2px rgba(0,0,0,0.05)',
                                                minWidth: '80px'
                                            }}
                                        >
                                            <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>{idx + 1}</span>
                                            <span style={{ fontSize: '0.75rem', opacity: currentPageIndex === idx ? 0.9 : 0.7 }}>{hasCrops > 0 ? `${hasCrops} תמונות` : 'לא טופל'}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* AI Auto Detect UI */}
                    <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <button className="btn btn-primary" onClick={handleAutoDetect} disabled={isAiLoading} style={{ width: 'auto', gap: '8px', background: 'white', color: '#2563eb', border: '2px solid #2563eb', boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)', borderRadius: '99px' }}>
                                {isAiLoading ? <Spinner size={20} className="spin" /> : <MagicWand size={20} />}
                                {isAiLoading ? 'מפענח...' : 'זיהוי תמונות אוטומטי לדף זה'}
                            </button>

                            {pendingCrops.length > 0 && (
                                <button className="btn btn-primary" onClick={handleUploadPendingCrops} disabled={isUploading} style={{ width: 'auto', gap: '8px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)', borderRadius: '99px' }}>
                                    {isUploading ? <Spinner size={20} className="spin" /> : <CloudArrowUp size={20} />}
                                    {isUploading ? `שומר... ${uploadProgress.current}/${uploadProgress.total}` : `שמור ${pendingCrops.length} חיתוכים באלבום עכשיו`}
                                </button>
                            )}
                            {isSlicing && <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}><Spinner size={16} className="spin" /> מחשב אזור...</span>}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#f8fafc', padding: '8px 16px', borderRadius: '50px', border: '1px solid #cbd5e1' }}>
                            <span style={{ fontSize: '0.9rem', color: '#475569', fontWeight: '600' }}>רגישות זיהוי אוטומטי (מרקם/צבע):</span>
                            <input
                                type="range"
                                min="20"
                                max="110"
                                value={aiSensitivity}
                                onChange={(e) => setAiSensitivity(Number(e.target.value))}
                                style={{ width: '150px', cursor: 'ew-resize' }}
                                title="הזז ימינה אם הזיהוי מפספס תמונות. הזז שמאלה אם הזיהוי חותך יותר מדי חלקי רקע."
                            />
                        </div>
                    </div>

                    <div
                        ref={containerRef}
                        style={{
                            position: 'relative', display: imageSrc ? 'inline-block' : 'none', cursor: 'crosshair', maxWidth: '100%', border: '2px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', minHeight: '300px'
                        }}
                        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={() => { if (isDrawing || interactingCrop) handleMouseUp(); }}
                    >
                        {!isImageLoaded && imageSrc && (
                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#64748b' }}>
                                <Spinner size={32} className="spin" />
                                <span>טוען דף...</span>
                            </div>
                        )}

                        {imageSrc && (
                            <img ref={imgRef} onLoad={() => setIsImageLoaded(true)} src={imageSrc} crossOrigin="anonymous" alt="Master Album Page" style={{ display: 'block', maxWidth: '100%', height: 'auto', maxHeight: '75vh', userSelect: 'none', opacity: isImageLoaded ? 1 : 0, transition: 'opacity 0.2s', width: '100%' }} draggable="false" />
                        )}

                        {imageSrc && isImageLoaded && allCrops.filter(c => c.pageIndex === currentPageIndex).map((crop) => (
                            <div key={crop.id}
                                onMouseDown={(e) => handleCropInteractStart(e, crop, 'move')}
                                style={{ position: 'absolute', left: crop.visualBox?.x, top: crop.visualBox?.y, width: crop.visualBox?.width, height: crop.visualBox?.height, border: crop.isLocal ? '4px dashed #f59e0b' : '3px solid #10b981', backgroundColor: crop.isLocal ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)', boxShadow: '0 0 0 1px rgba(255,255,255,0.5)', pointerEvents: 'auto', cursor: 'move' }}>

                                <div style={{ position: 'absolute', top: '-30px', right: '-4px', background: crop.isLocal ? '#f59e0b' : '#10b981', color: '#fff', fontSize: '13px', padding: '4px 8px', borderRadius: '6px 6px 0 0', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'auto', whiteSpace: 'nowrap', cursor: 'default' }} onMouseDown={e => e.stopPropagation()}>
                                    {crop.isLocal ? 'טיוטה מקומית לחיתוך (טרם נשמר)' : 'נשמר באלבום'}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleRemoveCrop(crop.id); }}
                                        style={{ background: 'white', color: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '2px 4px', display: 'flex', alignItems: 'center' }}
                                        title="מחק חיתוך זה"
                                    >
                                        <Trash size={14} weight="bold" />
                                    </button>
                                </div>

                                {/* Resize Handles */}
                                {crop.id === interactingCrop?.id || !interactingCrop ? (
                                    <>
                                        <div style={{ position: 'absolute', top: -5, left: -5, width: 10, height: 10, background: 'white', border: '1px solid black', cursor: 'nwse-resize', borderRadius: '50%' }} onMouseDown={(e) => handleCropInteractStart(e, crop, 'nw')} />
                                        <div style={{ position: 'absolute', top: -5, left: 'calc(50% - 5px)', width: 10, height: 10, background: 'white', border: '1px solid black', cursor: 'ns-resize', borderRadius: '50%' }} onMouseDown={(e) => handleCropInteractStart(e, crop, 'n')} />
                                        <div style={{ position: 'absolute', top: -5, right: -5, width: 10, height: 10, background: 'white', border: '1px solid black', cursor: 'nesw-resize', borderRadius: '50%' }} onMouseDown={(e) => handleCropInteractStart(e, crop, 'ne')} />
                                        <div style={{ position: 'absolute', top: 'calc(50% - 5px)', left: -5, width: 10, height: 10, background: 'white', border: '1px solid black', cursor: 'ew-resize', borderRadius: '50%' }} onMouseDown={(e) => handleCropInteractStart(e, crop, 'w')} />
                                        <div style={{ position: 'absolute', top: 'calc(50% - 5px)', right: -5, width: 10, height: 10, background: 'white', border: '1px solid black', cursor: 'ew-resize', borderRadius: '50%' }} onMouseDown={(e) => handleCropInteractStart(e, crop, 'e')} />
                                        <div style={{ position: 'absolute', bottom: -5, left: -5, width: 10, height: 10, background: 'white', border: '1px solid black', cursor: 'nesw-resize', borderRadius: '50%' }} onMouseDown={(e) => handleCropInteractStart(e, crop, 'sw')} />
                                        <div style={{ position: 'absolute', bottom: -5, left: 'calc(50% - 5px)', width: 10, height: 10, background: 'white', border: '1px solid black', cursor: 'ns-resize', borderRadius: '50%' }} onMouseDown={(e) => handleCropInteractStart(e, crop, 's')} />
                                        <div style={{ position: 'absolute', bottom: -5, right: -5, width: 10, height: 10, background: 'white', border: '1px solid black', cursor: 'nwse-resize', borderRadius: '50%' }} onMouseDown={(e) => handleCropInteractStart(e, crop, 'se')} />
                                    </>
                                ) : null}
                            </div>
                        ))}

                        {isImageLoaded && isDrawing && (
                            <div style={{ position: 'absolute', left: Math.min(startPos.x, currentPos.x), top: Math.min(startPos.y, currentPos.y), width: Math.abs(currentPos.x - startPos.x), height: Math.abs(currentPos.y - startPos.y), border: '2px dashed #3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.2)', pointerEvents: 'none' }} />
                        )}
                    </div>
                </div>

                {allCrops.length > 0 && (
                    <div className="card">
                        <div className="flex-between mb-4 flex-wrap gap-2" style={{ borderBottom: '2px solid #f1f5f9', paddingBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: pendingCrops.length > 0 ? '#f59e0b' : '#10b981', fontSize: '1.3rem' }}>
                                    <Scissors size={28} weight="fill" /> תמונות שזוהו ונחתכו {showAllCrops ? `(${allCrops.length} בכל האלבום)` : `(${allCrops.filter(c => c.pageIndex === currentPageIndex).length} בדף זה)`} {pendingCrops.length > 0 && `(מתוכן ${pendingCrops.length} טרם נשמרו)`}
                                </h3>
                                <button className="btn btn-secondary" onClick={() => setShowAllCrops(!showAllCrops)} style={{ padding: '6px 12px', fontSize: '0.9rem', width: 'auto' }}>
                                    {showAllCrops ? (
                                        <>הצג רק של דף {currentPageIndex + 1}</>
                                    ) : (
                                        <>הצג הכל ({allCrops.length} סה"כ)</>
                                    )}
                                </button>
                            </div>
                            {pendingCrops.length > 0 && (
                                <button className="btn btn-primary" onClick={handleUploadPendingCrops} disabled={isUploading} style={{ background: '#10b981', width: 'auto' }}>
                                    <CloudArrowUp size={20} /> אשרו ושמור עכשיו {pendingCrops.length} חיתוכים
                                </button>
                            )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                            {(showAllCrops ? allCrops : allCrops.filter(c => c.pageIndex === currentPageIndex)).map(crop => (
                                <div key={crop.id} style={{ border: `2px solid ${crop.isLocal ? '#f59e0b' : (crop.pageIndex === currentPageIndex ? '#3b82f6' : '#e2e8f0')}`, borderRadius: '12px', overflow: 'hidden', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ width: '100%', height: '200px', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                                        <img src={crop.mediaUrl} alt="crop" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />

                                        {crop.isLocal && (
                                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '4px', background: '#f59e0b', color: 'white', fontSize: '0.8rem', fontWeight: 'bold', textAlign: 'center' }}>
                                                טיוטה מקומית
                                            </div>
                                        )}

                                        <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '8px' }}>
                                            <button className="btn" onClick={() => handleRotateCrop(crop, 'CW')} title="סובב ימינה 90 מעלות" style={{ padding: '6px', width: 'auto', background: 'rgba(255,255,255,0.9)', color: '#334155', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                                                <ArrowClockwise size={18} weight="bold" />
                                            </button>
                                            <button className="btn" onClick={() => handleRotateCrop(crop, 'CCW')} title="סובב שמאלה 90 מעלות" style={{ padding: '6px', width: 'auto', background: 'rgba(255,255,255,0.9)', color: '#334155', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                                                <ArrowCounterClockwise size={18} weight="bold" />
                                            </button>
                                        </div>
                                    </div>
                                    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1, gap: '10px' }}>
                                        <div>
                                            <label style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600' }}>כותרת לפריט</label>
                                            <input type="text" className="form-input" value={crop.title} onBlur={(e) => handleUpdateCropField(crop.id, 'title', e.target.value)} onChange={(e) => crop.isLocal ? setPendingCrops(pendingCrops.map(c => c.id === crop.id ? { ...c, title: e.target.value } : c)) : setCrops(crops.map(c => c.id === crop.id ? { ...c, title: e.target.value } : c))} style={{ margin: 0 }} />
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                            <div>
                                                <label style={{ fontSize: '0.85rem', color: '#64748b' }}>שנה</label>
                                                <input type="text" className="form-input" value={crop.year} onBlur={(e) => handleUpdateCropField(crop.id, 'year', e.target.value)} onChange={(e) => crop.isLocal ? setPendingCrops(pendingCrops.map(c => c.id === crop.id ? { ...c, year: e.target.value } : c)) : setCrops(crops.map(c => c.id === crop.id ? { ...c, year: e.target.value } : c))} style={{ margin: 0 }} />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.85rem', color: '#64748b' }}>תיאור פתוח</label>
                                                <input type="text" className="form-input" value={crop.description} onBlur={(e) => handleUpdateCropField(crop.id, 'description', e.target.value)} onChange={(e) => crop.isLocal ? setPendingCrops(pendingCrops.map(c => c.id === crop.id ? { ...c, description: e.target.value } : c)) : setCrops(crops.map(c => c.id === crop.id ? { ...c, description: e.target.value } : c))} style={{ margin: 0 }} />
                                            </div>
                                        </div>
                                        <div style={{ marginTop: 'auto', paddingTop: '12px' }}>
                                            <button className="btn btn-secondary" style={{ width: '100%', color: '#ef4444', backgroundColor: '#fee2e2', border: 'none' }} onClick={() => handleRemoveCrop(crop.id)}>
                                                <Trash size={18} /> גיזום למחזור
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Default: Dashboard View
    return (
        <div>
            <div className="flex-between mb-4 flex-wrap gap-2">
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>פרויקטים - מעבדת דיגיטציה ופיצול אלבומים</h2>
                <button className="btn btn-primary" onClick={() => setView('create')} style={{ width: 'auto', gap: '8px', background: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)', boxShadow: '0 4px 15px rgba(168, 85, 247, 0.4)' }}>
                    <FolderPlus size={20} /> אלבום חדש לעבודה
                </button>
            </div>

            <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '1.1rem' }}>
                כאן מרוכזים כל אלבומי העבודה הפיזיים שהועלו ליצירת תמונות מפוצלות לדיגיצטיה.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
                {albums.length === 0 && (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px', background: '#f8fafc', borderRadius: '16px', border: '2px dashed #cbd5e1' }}>
                        <BookOpen size={64} color="#94a3b8" style={{ marginBottom: '16px' }} />
                        <h3 style={{ color: '#475569', margin: '0 0 8px 0' }}>אין כרגע אלבומים לעבודה</h3>
                        <p style={{ color: '#64748b', margin: 0 }}>התחל פרויקט חדש בצד שמאל למעלה כדי להעלות סריקות.</p>
                    </div>
                )}

                {albums.map(album => (
                    <div key={album.id} className="card" style={{ display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden', border: album.status === 'published' ? '2px solid #10b981' : '2px solid #e2e8f0' }}>
                        <div style={{ height: '180px', background: '#f1f5f9', position: 'relative' }}>
                            {album.pages && album.pages[0] ? (
                                <img src={album.pages[0].url} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Images size={48} color="#cbd5e1" /></div>
                            )}
                            <div style={{ position: 'absolute', top: '12px', right: '12px', background: album.status === 'published' ? '#10b981' : '#f59e0b', color: 'white', padding: '6px 12px', borderRadius: '99px', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
                                {album.status === 'published' ? <Globe size={16} /> : <LockKey size={16} />}
                                {album.status === 'published' ? 'מפורסם בארכיון' : 'טיוטת עבודה'}
                            </div>
                        </div>

                        <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <h3 style={{ fontSize: '1.3rem', margin: '0 0 8px 0', color: '#1e293b' }}>{album.title}</h3>
                            <p style={{ fontSize: '0.9rem', color: '#64748b', margin: '0 0 16px 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {album.description || 'ללא תיאור'}
                            </p>

                            <div style={{ display: 'flex', gap: '24px', marginBottom: '24px', padding: '12px 16px', background: '#f8fafc', borderRadius: '8px' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>דפי אלבום</div>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#334155', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                        <BookOpen size={20} color="#3b82f6" /> {album.pages?.length || 0}
                                        {album.treatedPages?.length > 0 && <span style={{ fontSize: '0.8rem', color: '#10b981', background: '#dcfce7', padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap' }}>({album.treatedPages.length} עברו טיפול)</span>}
                                    </div>
                                </div>
                                <div style={{ width: '1px', background: '#e2e8f0' }}></div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>תמונות נגזרו</div>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Scissors size={20} color="#a855f7" /> {album.cropsCount || 0}
                                    </div>
                                </div>
                            </div>

                            <div style={{ marginTop: 'auto', display: 'flex', gap: '12px' }}>
                                <button className="btn btn-secondary" onClick={() => {
                                    setActiveAlbum(album);
                                    const untreatedIndex = album.pages?.findIndex((_, idx) => !album.treatedPages?.includes(idx));
                                    setCurrentPageIndex(untreatedIndex !== -1 && untreatedIndex !== undefined ? untreatedIndex : 0);
                                    setView('edit');
                                }} style={{ flex: 1, padding: '10px', gap: '6px' }}>
                                    <PencilSimple size={18} /> המשך עבודה
                                </button>
                                {album.status === 'draft' ? (
                                    <button className="btn btn-primary" onClick={() => handlePublishAlbum(album)} style={{ flex: 1, padding: '10px', gap: '6px', background: '#10b981' }}>
                                        <Globe size={18} /> פרסם הכל
                                    </button>
                                ) : (
                                    <button className="btn btn-secondary" onClick={() => handleDraftAlbum(album)} style={{ flex: 1, padding: '10px', gap: '6px', color: '#f59e0b', background: '#fffbeb', border: 'none' }}>
                                        <LockKey size={18} /> החזר לטיוטה
                                    </button>
                                )}
                                <button className="btn btn-secondary" onClick={() => handleDeleteAlbum(album)} style={{ padding: '10px', background: '#fee2e2', color: '#ef4444', border: 'none' }}>
                                    <Trash size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default ManageAlbumDigitizer;
