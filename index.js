const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const session = require('express-session');


const app = express();

// Set up body-parser
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Set up express-session
app.use(session({
    secret: 'your_secret_key', // Change this to a real secret key in production
    resave: false,
    saveUninitialized: true
}));

// Set the view engine to EJS
app.set('view engine', 'ejs');

// MySQL connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root', 
    password: '', 
    database: 'havaalani'
});
db.connect((err) => {
    if (err) throw err;
    console.log('Connected to MySQL');
});

const checkNotAuthenticated = (req, res, next) => {
    if (!!req.session.loggedIn) {
        return res.redirect('/dashboard');
    }
    next();
};

app.get('/', checkNotAuthenticated, (req, res) => {
    res.render('login'); // Render the login page
});

// Dashboard page
app.get('/dashboard', (req, res) => {
    if (req.session.loggedIn) { 
        try {
            res.render('dashboard'); 
        } catch (err) {
            console.error(err);
            res.status(500).send('Internal Server Error');
        }
    } else {
        res.redirect('/');
    }
});

// Uçaklar sayfası
app.get('/ucaklar', (req, res) => {
    res.render('ucaklar');
});

// Notlar sayfası
app.get('/notlar', (req, res) => {
    res.render('notlar');
});

// Çıkış işlemi
app.get('/cikis', (req, res) => {
    req.session.destroy(); 
    res.redirect('/');
});

// Handle the login POST request
app.post('/login', (req, res) => {
    const { kullanici_adi, sifre } = req.body;
    
    const query = "SELECT * FROM kullanıcı_giris WHERE kullanici_adi = ? AND sifre = ?";
    db.query(query, [kullanici_adi, sifre], (err, results) => {
        if (err) throw err;
        if (results.length > 0) {
            req.session.loggedIn = true;
            res.redirect('/dashboard');
        } else {
            res.send('Yanlis kullanici adi veya sifre');
        }
    });
});


app.get('/api/sehir-ucus-doluluk/:sehir', (req, res) => {
    const sehir = req.params.sehir.toLowerCase(); // Kullanıcı girişini küçük harfe çevir
    const sorgu = `
        SELECT oran, COUNT(*) AS ucus_sayisi
        FROM ucus u
        JOIN havaalani h ON u.inis_id = h.havaalani_id or u.kalkis_id = h.havaalani_id
        JOIN iller i ON h.il_id = i.il_id
        WHERE LOWER(i.il_ad) = ?
        GROUP BY oran
        ORDER BY oran;
    `;

    db.query(sorgu, [sehir], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Internal Server Error');
        }
        res.json(results);
    });
});

app.get('/api/top-10-havaalani', (req, res) => {
    const sorgu = `
    SELECT h.havaalani_ad, COUNT(u.id) AS ucus_sayisi
    FROM ucus u
    JOIN havaalani h ON h.havaalani_id = u.inis_id OR h.havaalani_id = u.kalkis_id
    GROUP BY h.havaalani_ad
    ORDER BY ucus_sayisi DESC
    LIMIT 10;    
`;
    
        db.query(sorgu, (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }
            res.json(results);
        });
})

app.get('/api/doluluk-dilimleri', (req, res) => {
    const sorgu = ` 
    SELECT 
        CASE 
            WHEN oran BETWEEN 0 AND 10 THEN '0-10%'
            WHEN oran BETWEEN 10 AND 20 THEN '10-20%'
            WHEN oran BETWEEN 20 AND 30 THEN '20-30%'
            WHEN oran BETWEEN 30 AND 40 THEN '30-40%'
            WHEN oran BETWEEN 40 AND 50 THEN '40-50%'
            WHEN oran BETWEEN 50 AND 60 THEN '50-60%'
            WHEN oran BETWEEN 60 AND 70 THEN '60-70%'
            WHEN oran BETWEEN 70 AND 80 THEN '70-80%'
            WHEN oran BETWEEN 80 AND 90 THEN '80-90%'
            WHEN oran BETWEEN 90 AND 100 THEN '90-100%'
        END AS doluluk_dilimi,
        COUNT(*) AS ucus_sayisi
    FROM ucus
    GROUP BY doluluk_dilimi;
`;

    db.query(sorgu, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Internal Server Error');
        }
        res.json(results);
    });
});

app.get('/api/ucak-durum', (req, res) => {
    const sorgu = `
        SELECT ud.durum, COUNT(*) AS ucak_sayisi
        FROM ucak u
        JOIN ucak_durum ud ON u.durum_id = ud.durum_id
        GROUP BY ud.durum;
    `;

    db.query(sorgu, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Internal Server Error');
        }
        res.json(results);
    });
});

app.get('/api/ucaklar', (req, res) => {
    const sorgu = `
    SELECT u.*, ud.durum 
    FROM ucak u 
    JOIN ucak_durum ud ON u.durum_id = ud.durum_id;
    `;

    db.query(sorgu, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Internal Server Error');
        }
        res.json(results);
    });
});

app.get('/api/ucak-kapasite/:kapasite', (req, res) => {
    const kapasite = req.params.kapasite;
    const sorgu = `
        SELECT * FROM ucak WHERE kapasite = ?;
    `;

    db.query(sorgu, [kapasite], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Internal Server Error');
        }
        res.json(results);
    });
});
app.get('/api/notlar', (req, res) => {
    const sorgu = `
        SELECT * FROM notlar;
    `;

    db.query(sorgu, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Internal Server Error');
        }
        res.json(results);
    });
});

app.post('/api/not-ekle', (req, res) => {
    const { not }  = req.body;

    const tarih = new Date();
    const sorgu = `
        INSERT INTO notlar (alinan_not, eklenen_tarih) VALUES (?, ?);
    `;

    db.query(sorgu, [not, tarih], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Internal Server Error');
        }
        res.json(results);
    });
});




const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
