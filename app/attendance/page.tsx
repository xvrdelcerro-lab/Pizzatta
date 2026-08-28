"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { Plus, Trash2, Edit2, X } from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";

interface AttendanceRecord {
  id: string;
  name: string;
  date: string;
  inTime: string | null;
  outTime: string | null;
  workedHours: string;
}

interface Worker {
  id: string;
  name: string;
}

export default function AttendancePage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedName, setSelectedName] = useState("");
  const [newWorkerName, setNewWorkerName] = useState("");
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [status, setStatus] = useState("");
  const [isAddingWorker, setIsAddingWorker] = useState(false);
  const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null);
  const [editWorkerNameVal, setEditWorkerNameVal] = useState("");
  const [workerToDelete, setWorkerToDelete] = useState<{ id: string; name: string } | null>(null);

  const formatDateOnly = (dateObj: Date) => {
    const day = String(dateObj.getDate()).padStart(2, '0');
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[dateObj.getMonth()];
    const year = dateObj.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const formatTimeOnly = (dateObj: Date) => {
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const mins = String(dateObj.getMinutes()).padStart(2, '0');
    return `${hours}:${mins}`;
  };

  const fetchWorkersAndAttendance = async () => {
    try {
      const workersSnap = await getDocs(collection(db, "workers"));
      const workerList: Worker[] = [];
      workersSnap.docs.forEach(d => {
        const data = d.data();
        if (data.name) {
          workerList.push({ id: d.id, name: data.name });
        }
      });
      setWorkers(workerList);

      const attSnap = await getDocs(collection(db, "attendance"));
      const records: AttendanceRecord[] = [];
      attSnap.docs.forEach(d => {
        const data = d.data();
        
        let recDate = data.date || "";
        if (!recDate && data.inTime && typeof data.inTime === "string" && data.inTime.includes("-")) {
          recDate = data.inTime.split(" ")[0];
        }
        if (!recDate && data.timestamp) {
          const ts = data.timestamp.seconds ? new Date(data.timestamp.seconds * 1000) : new Date(data.timestamp);
          if (!isNaN(ts.getTime())) recDate = formatDateOnly(ts);
        }
        if (!recDate) {
          recDate = formatDateOnly(new Date());
        }

        records.push({
          id: d.id,
          name: data.name || "",
          date: recDate,
          inTime: data.inTime || null,
          outTime: data.outTime || null,
          workedHours: data.workedHours || "0.00 hrs"
        });
      });
      setAttendanceRecords(records);
    } catch (e) {
      console.error("Error fetching attendance:", e);
    }
  };

  useEffect(() => {
    fetchWorkersAndAttendance();
  }, []);

  const handleAddWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkerName.trim()) return;

    try {
      await addDoc(collection(db, "workers"), { name: newWorkerName.trim() });
      setNewWorkerName("");
      setIsAddingWorker(false);
      setStatus("Worker added successfully!");
      fetchWorkersAndAttendance();
      setTimeout(() => setStatus(""), 3000);
    } catch (e) {
      console.error("Error adding worker:", e);
      setStatus("Error adding worker.");
    }
  };

  const handleStartEditWorker = (w: Worker) => {
    setEditingWorkerId(w.id);
    setEditWorkerNameVal(w.name);
  };

  const handleSaveEditWorker = async (wId: string) => {
    if (!editWorkerNameVal.trim()) return;

    try {
      await updateDoc(doc(db, "workers", wId), { name: editWorkerNameVal.trim() });
      setEditingWorkerId(null);
      setEditWorkerNameVal("");
      setStatus("Worker updated successfully!");
      fetchWorkersAndAttendance();
      setTimeout(() => setStatus(""), 3000);
    } catch (e) {
      console.error("Error updating worker:", e);
      setStatus("Error updating worker.");
    }
  };

  const handleDeleteWorker = (workerId: string, workerName: string) => {
    setWorkerToDelete({ id: workerId, name: workerName });
  };

  const confirmDeleteWorker = async () => {
    if (!workerToDelete) return;
    try {
      await deleteDoc(doc(db, "workers", workerToDelete.id));
      setStatus("Worker deleted successfully!");
      fetchWorkersAndAttendance();
      setTimeout(() => setStatus(""), 3000);
    } catch (e) {
      console.error("Error deleting worker:", e);
      setStatus("Error deleting worker.");
    }
    setWorkerToDelete(null);
  };

  const handleRegisterIn = async () => {
    if (!selectedName) {
      setStatus("Please select a worker name first.");
      setTimeout(() => setStatus(""), 3000);
      return;
    }

    try {
      const now = new Date();
      const dateStr = formatDateOnly(now);
      const timeStr = formatTimeOnly(now);

      const newRecord = {
        name: selectedName,
        date: dateStr,
        inTime: timeStr,
        outTime: null,
        workedHours: "0.00 hrs"
      };

      await addDoc(collection(db, "attendance"), newRecord);
      setStatus("IN time registered successfully!");
      setSelectedName("");
      fetchWorkersAndAttendance();
      setTimeout(() => setStatus(""), 3000);
    } catch (e) {
      console.error("Error registering IN:", e);
      setStatus("Error registering IN time.");
    }
  };

  const handleRegisterOut = async (record: AttendanceRecord) => {
    if (!record.inTime) {
      setStatus("Cannot register OUT if there's no IN.");
      setTimeout(() => setStatus(""), 4000);
      return;
    }

    try {
      const outDateObj = new Date();
      const outTimeStr = formatTimeOnly(outDateObj);

      const dateParts = record.date.split("-");
      const timeParts = record.inTime.split(":");
      const monthMap: {[k:string]: number} = {Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11};
      const inDate = new Date(Number(dateParts[2]), monthMap[dateParts[1]], Number(dateParts[0]), Number(timeParts[0]), Number(timeParts[1]));

      const diffMs = outDateObj.getTime() - inDate.getTime();
      const diffHrs = Math.max(0, diffMs / (1000 * 60 * 60));
      const workedStr = `${diffHrs.toFixed(2)} hrs`;

      await updateDoc(doc(db, "attendance", record.id), {
        outTime: outTimeStr,
        workedHours: workedStr
      });

      setStatus("OUT time registered successfully!");
      fetchWorkersAndAttendance();
      setTimeout(() => setStatus(""), 3000);
    } catch (e) {
      console.error("Error registering OUT:", e);
      setStatus("Error registering OUT time.");
    }
  };

  return (
    <div className="min-h-screen bg-white p-8 pl-12">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center" style={{ color: '#548235' }}>
          ATTENDANCE MANAGEMENT
        </h1>

        {status && (
          <div className="mb-4 text-center p-2 bg-green-50 rounded font-bold border border-[#548235]" style={{ color: '#548235' }}>
            {status}
          </div>
        )}

        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold" style={{ color: '#548235' }}>Workers Directory</h2>
          <button
            type="button"
            onClick={() => setIsAddingWorker(!isAddingWorker)}
            className="flex items-center gap-2 px-4 py-1.5 font-bold text-white rounded text-sm shadow transition hover:opacity-90"
            style={{ backgroundColor: '#548235' }}
          >
            <Plus size={16} /> {isAddingWorker ? "Cancel" : "Add New Worker"}
          </button>
        </div>

        {isAddingWorker && (
          <form onSubmit={handleAddWorker} className="flex gap-2 mb-6 bg-gray-50 p-4 rounded-lg border border-[#548235]">
            <input
              type="text"
              placeholder="Enter worker full name..."
              className="flex-1 p-2 border border-[#548235] rounded bg-white text-gray-800 text-sm focus:outline-none"
              value={newWorkerName}
              onChange={(e) => setNewWorkerName(e.target.value)}
              required
            />
            <button
              type="submit"
              className="px-5 py-2 font-bold text-white rounded text-sm shadow hover:opacity-90"
              style={{ backgroundColor: '#548235' }}
            >
              Save Worker
            </button>
          </form>
        )}

        {/* WORKER SUMMARY / DIRECTORY LIST SECTION (MOVED BEFORE DETAILED LOGS TABLE AS REQUIRED) */}
        {workers.length > 0 && (
          <div className="mb-8 border border-gray-200 rounded-lg p-4 bg-gray-50">
            <h3 className="font-bold text-sm text-gray-700 mb-2">Registered Workers List</h3>
            <div className="flex flex-wrap gap-2">
              {workers.map((w) => (
                <div key={w.id} className="flex items-center gap-2 bg-white border border-[#548235] px-3 py-1.5 rounded text-sm text-gray-800 shadow-sm">
                  {editingWorkerId === w.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        className="p-1 border border-[#548235] rounded text-xs focus:outline-none"
                        value={editWorkerNameVal}
                        onChange={(e) => setEditWorkerNameVal(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveEditWorker(w.id)}
                        className="text-[#548235] font-bold text-xs px-1"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingWorkerId(null)}
                        className="text-gray-400 hover:text-gray-650"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span>{w.name}</span>
                      <button 
                        type="button" 
                        onClick={() => handleStartEditWorker(w)}
                        className="text-gray-400 hover:text-[#548235] ml-1"
                        title="Edit Worker Name"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        type="button" 
                        onClick={() => handleDeleteWorker(w.id, w.name)}
                        className="text-gray-400 hover:text-[#548235]"
                        title="Delete Worker"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-4 items-center mb-8 bg-green-50 p-4 rounded-lg border border-[#548235]">
          <div className="flex-1">
            <label className="block text-sm font-bold text-gray-700 mb-1">Select Worker</label>
            <select
              className="w-full p-2 border border-[#548235] rounded bg-white text-gray-800 text-sm focus:outline-none"
              value={selectedName}
              onChange={(e) => setSelectedName(e.target.value)}
            >
              <option value="">-- Choose Worker --</option>
              {workers.map((w) => (
                <option key={w.id} value={w.name}>{w.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={handleRegisterIn}
              className="flex items-center gap-2 px-6 py-2 font-bold text-white rounded shadow transition hover:opacity-90 mt-6"
              style={{ backgroundColor: '#548235' }}
            >
              <Plus size={18} /> Register IN
            </button>
          </div>
        </div>

        {/* DETAILED ATTENDANCE LOGS TABLE */}
        <div className="border border-[#548235] rounded-lg overflow-hidden shadow-sm">
          <table className="w-full border-collapse bg-white text-left">
            <thead>
              <tr className="bg-green-50 border-b border-[#548235]" style={{ color: '#548235' }}>
                <th className="p-3 font-bold border-r border-[#548235]">Date</th>
                <th className="p-3 font-bold border-r border-[#548235]">Name</th>
                <th className="p-3 font-bold border-r border-[#548235]">In</th>
                <th className="p-3 font-bold border-r border-[#548235]">Out</th>
                <th className="p-3 font-bold text-center">Worked Time</th>
              </tr>
            </thead>
            <tbody>
              {attendanceRecords.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-gray-400">
                    No attendance logs recorded.
                  </td>
                </tr>
              ) : (
                attendanceRecords.map((rec) => (
                  <tr key={rec.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="p-3 font-semibold text-gray-800 border-r border-gray-200">{rec.date || formatDateOnly(new Date())}</td>
                    <td className="p-3 font-semibold text-gray-800 border-r border-gray-200">{rec.name}</td>
                    
                    <td className="p-3 border-r border-gray-200 font-bold" style={{ color: '#548235' }}>
                      {rec.inTime ? (
                        <span>{rec.inTime.includes(" ") ? rec.inTime.split(" ").pop() : rec.inTime}</span>
                      ) : (
                        <span className="text-gray-400">Not clocked in</span>
                      )}
                    </td>

                    <td className="p-3 border-r border-gray-200">
                      {rec.outTime ? (
                        <span className="font-bold text-gray-800">{rec.outTime.includes(" ") ? rec.outTime.split(" ").pop() : rec.outTime}</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRegisterOut(rec)}
                          className="px-3 py-1 bg-green-100 border border-[#548235] text-[#548235] rounded font-bold text-xs hover:bg-green-200 transition"
                        >
                          Register OUT
                        </button>
                      )}
                    </td>

                    <td className="p-3 text-center font-bold text-gray-800">
                      {rec.workedHours}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        open={!!workerToDelete}
        message={`Are you sure you want to delete worker "${workerToDelete?.name}"?`}
        onConfirm={confirmDeleteWorker}
        onCancel={() => setWorkerToDelete(null)}
      />
    </div>
  );
}