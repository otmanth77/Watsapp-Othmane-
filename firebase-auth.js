import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";

import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  runTransaction,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBBkETYwXgVe-guzcJXkGwNp0C9ab4Mhqs",
  authDomain: "watsapp-othmane.firebaseapp.com",
  projectId: "watsapp-othmane",
  storageBucket: "watsapp-othmane.firebasestorage.app",
  messagingSenderId: "509633790692",
  appId: "1:509633790692:web:f672869edf927a8b11e2f1"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

window.searchRegisteredUser = async function () {
  const input = document.getElementById("userSearchInput");
  const resultBox = document.getElementById("userSearchResult");
  const username = input.value.trim().toLowerCase().replace(/^@/, "");

  resultBox.textContent = "";

  if (!auth.currentUser) {
    resultBox.textContent = "خاصك تسجل الدخول أولاً.";
    return;
  }

  if (!/^[a-z0-9_.-]{3,25}$/.test(username)) {
    resultBox.textContent = "دخل اسم مستخدم صحيح من 3 حتى 25 حرف.";
    return;
  }

  resultBox.textContent = "كنقلبو على المستخدم...";

  try {
    const usernameSnap = await getDoc(doc(db, "usernames", username));

    if (!usernameSnap.exists()) {
      resultBox.textContent = "ما لقيناش مستخدم بهاد الاسم.";
      return;
    }

    const uid = usernameSnap.data().uid;

    if (uid === auth.currentUser.uid) {
      resultBox.textContent = "هاد اسم المستخدم ديالك.";
      return;
    }

    const profileSnap = await getDoc(doc(db, "publicProfiles", uid));

    if (!profileSnap.exists()) {
      resultBox.textContent = "الملف العام ديال المستخدم غير موجود.";
      return;
    }

    const profile = profileSnap.data();
    resultBox.textContent = "";

    const name = document.createElement("div");
    name.textContent = profile.name || "مستخدم";
    name.style.fontWeight = "bold";

    const handle = document.createElement("div");
    handle.textContent = "@" + (profile.username || username);

    resultBox.appendChild(name);
    resultBox.appendChild(handle);

  } catch (error) {
    console.error("User search error:", error);
    resultBox.textContent = "وقع مشكل فالبحث. حاول مرة أخرى.";
  }
};


auth.languageCode = "ar";

const form = document.getElementById("registrationForm");
const screen = document.getElementById("registrationScreen");
const submit = document.getElementById("regSubmit");

let verifier = null;
let confirmation = null;
let registrationInProgress = false;

onAuthStateChanged(auth, async user => {
  if (registrationInProgress) return;

  if (!user) {
    screen.style.display = "block";
    return;
  }

  try {
    const profile = await getDoc(doc(db, "users", user.uid));
    if (profile.exists()) {
      screen.style.display = "none";
    } else {
      await signOut(auth);
      screen.style.display = "block";
    }
  } catch (error) {
    console.error(error);
    screen.style.display = "block";
  }
});

function message(text) {
  alert(text);
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  event.stopImmediatePropagation();

  if (confirmation) {
    message("تم إرسال الرمز. أدخل رمز التحقق في الخانة الموجودة أسفل.");
    return;
  }

  const name = document.getElementById("regName").value.trim();
  const country = document.getElementById("regCountry").value;
  let phone = document.getElementById("regPhone").value.trim();
  const username = document.getElementById("regUsername").value.trim().toLowerCase();
  const language = document.getElementById("regLanguage").value;
  const terms = document.getElementById("regTerms").checked;

  phone = phone.replace(/[\s()-]/g, "");
  if (country === "+212" && phone.startsWith("0")) {
    phone = phone.slice(1);
  }
  const fullPhone = country + phone;

  if (!name || !terms || !/^\+[1-9]\d{7,14}$/.test(fullPhone)) {
    message("تأكد من الاسم ورقم الهاتف والموافقة على الشروط.");
    return;
  }

  if (!/^[a-z0-9_.-]{3,25}$/.test(username)) {
    message("اسم المستخدم خاصو يكون بين 3 و25 حرف، وبلا فراغات.");
    return;
  }

  registrationInProgress = true;
  submit.disabled = true;

  try {
    let captchaBox = document.getElementById("recaptcha-container");

    if (!captchaBox) {
      captchaBox = document.createElement("div");
      captchaBox.id = "recaptcha-container";
      captchaBox.style.margin = "15px auto";
      form.appendChild(captchaBox);
    }

    if (!verifier) {
      verifier = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "normal"
      });
      await verifier.render();
    }

    confirmation = await signInWithPhoneNumber(auth, fullPhone, verifier);

    let codeBox = document.getElementById("firebase-sms-code");

    if (!codeBox) {
      codeBox = document.createElement("input");
      codeBox.id = "firebase-sms-code";
      codeBox.type = "text";
      codeBox.inputMode = "numeric";
      codeBox.autocomplete = "one-time-code";
      codeBox.maxLength = 6;
      codeBox.placeholder = "أدخل رمز التحقق";
      codeBox.className = "reg-input";
      codeBox.style.marginTop = "12px";
      form.appendChild(codeBox);

      const verifyButton = document.createElement("button");
      verifyButton.type = "button";
      verifyButton.className = "reg-submit";
      verifyButton.textContent = "تأكيد الرمز وإنشاء الحساب";
      verifyButton.onclick = async () => {
        const code = codeBox.value.trim();

        if (!/^\d{6}$/.test(code)) {
          message("أدخل رمز التحقق المكوّن من 6 أرقام.");
          return;
        }

        verifyButton.disabled = true;

        try {
          const result = await confirmation.confirm(code);
          const uid = result.user.uid;

          if (result.user.phoneNumber !== fullPhone) {
            throw new Error("PHONE_MISMATCH");
          }

          await runTransaction(db, async transaction => {
            const usernameRef = doc(db, "usernames", username);
            const usernameSnap = await transaction.get(usernameRef);

            if (usernameSnap.exists()) {
              throw new Error("USERNAME_EXISTS");
            }

            transaction.set(usernameRef, { uid });

            transaction.set(doc(db, "users", uid), {
              name,
              username,
              phone: fullPhone,
              language
            });

            transaction.set(doc(db, "publicProfiles", uid), {
              name,
              username,
              language
            });
          });

          message("تم تأكيد رقم الهاتف وإنشاء الحساب بنجاح.");
          registrationInProgress = false;
          screen.style.display = "none";

        } catch (error) {
          verifyButton.disabled = false;

          if (
            error.code === "auth/invalid-verification-code" ||
            error.code === "auth/code-expired"
          ) {
            message("الرمز غير صحيح أو انتهت صلاحيته. حاول مرة أخرى.");
            return;
          }

          await signOut(auth).catch(() => {});
          registrationInProgress = false;
          confirmation = null;
          verifier?.clear();
          verifier = null;
          submit.disabled = false;
          codeBox.remove();
          verifyButton.remove();

          if (error.message === "USERNAME_EXISTS") {
            message("اسم المستخدم مستعمل. اختار اسماً آخر وأعد التسجيل.");
          } else {
            message("تعذر حفظ الحساب. حاول التسجيل من جديد.");
            console.error(error);
          }
        }
      };

      form.appendChild(verifyButton);
    }

    codeBox.focus();
    message("تم إرسال رمز التحقق إلى هاتفك.");

  } catch (error) {
    console.error(error);
    confirmation = null;
    registrationInProgress = false;
    submit.disabled = false;
    message("تعذر إرسال الرمز. تأكد من رقم الهاتف والتحقق من أنك لست برنامجاً آلياً.");
  }
}, true);
