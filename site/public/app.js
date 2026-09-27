// Demo page for ipyspeck / stspeck: the shared SpeckViewer driven by plain
// DOM controls. Structures load live from RCSB and AlphaFold DB.
(function () {
  "use strict";
  var S = window.Speck;
  var GALLERY = "https://raw.githubusercontent.com/denphi/speck/master/media/gallery/";

  // Looks shared with the viewer's toolbar and apply_preset() in Python
  var PRESETS = S.LOOKS;

  var SAMPLES = [
    {label: "AlphaFold RPP7", query: "Q8W3K0", preset: "cover", settings: {cartoon: true, cartoonColor: "plddt"}},
    {label: "Hemoglobin", query: "4HHB", preset: "glossy",
     settings: {cartoon: true, cartoonColor: "chain", surface: true, surfaceOpacity: 0.3, surfaceColor: "#eef2f8",
                highlight: {resName: "HEM"}, highlightScale: 1.3, shadows: 0.4}},
    {label: "Virus capsid", query: "1STM-assembly1", preset: "cover", settings: {cartoon: true, cartoonColor: "chain"}},
    {label: "Ribosome (mmCIF)", query: "4V6X", preset: "cover", settings: {cartoon: true, cartoonColor: "chain", ligands: false}},
    {label: "Nucleosome", query: "1KX5", preset: "cover", settings: {cartoon: true, cartoonColor: "chain", ligands: false}},
    {label: "Spike", query: "6VXX", preset: "cover",
     settings: {surface: true, surfaceColor: "chain", surfaceResolution: 0.8}},
    {label: "GFP", query: "1EMA", preset: "glossy",
     settings: {cartoon: true, cartoonColor: "#3fbf66", highlight: {resName: "CRO"}, highlightScale: 2.0}},
    {label: "Ubiquitin", query: "1UBQ", preset: "glossy",
     settings: {surface: true, surfaceColor: "rainbow", shadows: 0.5}},
    {label: "Gold cluster", preset: "metal", data: "247\n\nAu     13.039823419999999     12.808387800000000     12.823100419999999\nAu     14.106025180000001     10.679636240000001     14.179695660000000\nAu     11.044783880000001     11.449406020000000     14.123961540000000\nAu     11.136579220000000     14.309975939999999     14.368438760000000\nAu     13.895705980000001     15.334157540000000     13.852859279999999\nAu     15.636367240000002     12.996428119999999     14.000823199999999\nAu     12.200740760000000     10.531321320000000     11.516889020000001\nAu     13.314824900000001     13.011346919999999     15.649572640000001\nAu     10.537725120000001     12.958167299999999     11.836336720000000\nAu     15.119902460000000     14.298941800000001     11.549833619999999\nAu     15.028701999999999     11.297233739999999     11.525418580000000\nAu     13.169072020000000     12.954808100000001     10.093539560000000\nAu     14.039370020000000     10.309995799999999     16.850720899999999\nAu     11.302736639999999     11.236406479999999     17.004957319999999\nAu     11.184774899999999     14.006075200000002     17.651862019999999\nAu     11.992604000000000     15.301646360000001     11.536888739999998\nAu     14.150435260000002     15.362976720000001     16.847713480000003\nAu     15.908077379999998     12.913240860000000     16.815481020000000\nAu     16.773757000000000     10.615281040000001     15.299311819999998\nAu      9.315207720000000     12.776114520000000     15.915448379999999\nAu     11.860028180000000     16.586535939999997     15.811216979999999\nAu     16.323994180000000     15.610071619999999     15.203691099999999\nAu     15.867002059999999      8.997207440000000     12.653964700000000\nAu     13.264042740000001      8.321371240000000     13.062831599999999\nAu     10.151830000000000      9.266276500000000     12.742837380000001\nAu     12.126648560000000      9.083672780000001     15.501371600000001\nAu      8.476727739999999     11.455192840000000     13.318611800000001\nAu     10.146392100000000     16.739120320000001     13.397370219999999\nAu     12.637684540000000     17.633696080000000     12.826730019999999\nAu     15.551694859999998     16.999698039999998     12.631739379999999\nAu     17.528956900000001     14.547007279999999     12.724635300000001\nAu     17.433816919999998     11.651176679999999     12.503822240000000\nAu     14.082008200000001      8.890383320000000     10.392590780000001\nAu      8.465880799999999     14.334362639999998     13.559029899999999\nAu      9.674396679999999     10.688009279999999     10.361147160000000\nAu      9.516212160000000     10.758762819999999      7.504812380000001\nAu      9.491785680000000     15.615748979999999      8.069195160000000\nAu     16.852188859999998     13.123292000000001      9.771925280000000\nAu     10.494427580000000     13.122431659999998      8.958533740000000\nAu     12.087056799999999     15.593050980000001      8.919846260000000\nAu     14.786308160000001     14.700080200000002      8.558145179999999\nAu     14.876698200000000     11.213385039999999      8.613419100000000\nAu     13.527052240000000     13.057765500000000     18.440960459999999\nAu     14.863230980000001      7.858639100000000     15.581491380000001\nAu     12.061523240000000     10.660087360000000      8.750634100000001\nAu      9.264195980000000      9.775149799999999     15.647199100000000\nAu     14.363211459999999     17.755272340000001     15.150683860000001\nAu     18.204572100000000     13.346813219999998     15.266396600000000\nAu     11.178688820000000      8.121282519999999     10.283462280000000\nAu      7.819322160000000     12.994281820000001     11.041207840000000\nAu     10.917334739999999     17.585030319999998     10.744356740000001\nAu     16.665514840000000     16.252212340000000     10.051942940000000\nAu      9.324959540000000     15.625784459999998     16.009806019999999\nAu     17.100065319999999     10.257777400000000      9.942154819999999\nAu     12.736456980000000     13.253075679999998      7.193759300000000\nAu     16.712354099999999     10.615591479999999     18.107299859999998\nAu      9.182398680000000     12.181582920000000     18.460568360000000\nAu     12.133165980000001     16.501177420000001     18.833141860000001\nAu     16.763189820000001     15.431077739999999     17.917964479999998\nAu     18.482953060000000      9.000034160000000     14.046686940000001\nAu     11.039948140000000      6.868476419999999     13.642481579999998\nAu      6.351747740000000     12.742910700000001     14.855305140000000\nAu     12.449667880000000      7.230496780000000     17.832390159999999\nAu     10.926690320000001     19.009866719999998     15.065133720000002\nAu     14.736684300000000      6.374420780000000     12.068372159999999\nAu      7.390783920000000      9.239324120000001     11.919912679999999\nAu      7.497635340000000     16.744022099999999     12.780854059999999\nAu     14.987437139999999     19.281000700000000     11.387132380000001\nAu     19.370113880000002     13.332546499999999     11.051224340000001\nAu     13.808168400000000      8.867958060000001      7.630148240000000\nAu     18.198152700000001     17.113536959999998     13.829132200000000\nAu      9.407763820000000     15.324454080000001     11.040897400000000\nAu     13.989706379999999     17.148306760000001     10.173193160000000\nAu     13.900520660000002     17.111199820000000      7.313302100000000\nAu      9.899253260000000     19.395467779999997     12.610649479999999\nAu     11.583364520000000     11.341433740000001     19.692591879999998\nAu      9.710112360000000     13.553536359999999     21.080023120000000\nAu     14.528896720000001     15.268616739999999     19.668516399999998\nAu     16.210585559999998     12.991450420000000     19.610288360000002\nAu     15.387225619999999      8.272464720000000     18.506350720000000\nAu     10.269315160000000      8.978249020000000     18.219401460000000\nAu     14.450996820000000     10.601446960000001     19.631142180000001\nAu      9.522008860000001     15.458781779999999     18.998566080000000\nAu     18.428226440000003     13.295265359999998     18.107885899999999\nAu     19.046060019999999     10.933767000000000     16.764832240000000\nAu     17.530277180000002      8.408944699999999     16.716745759999998\nAu     12.738780860000000      4.370489239999999     16.974906260000001\nAu     10.308982320000000      7.240400960000000     16.165801080000001\nAu      7.299297719999999     11.051067820000000     16.750871280000002\nAu     15.005291079999999     17.612946520000001     18.115971120000001\nAu      7.394776480000001     14.089648299999999     17.224721799999998\nAu     10.014750200000000     17.852421600000000     17.541269720000003\nAu     12.645812920000001     18.749875299999999     17.124778839999998\nAu     19.134345100000001     15.717644540000000     16.180342100000001\nAu     16.653381940000003      6.679902840000000     13.970331440000001\nAu     13.611502320000000      5.770387220000000     14.484397200000000\nAu      8.253753039999999      7.676050200000001     13.866625500000000\nAu      4.563473979999999     10.690937399999999     15.314998140000000\nAu      6.520530899999999     15.682271540000002     15.219160840000001\nAu     16.944425680000002     18.087670899999999     16.273183939999999\nAu      8.326093100000000     18.066129640000000     15.195211459999999\nAu     16.209591320000001     19.707315160000000     13.950439619999999\nAu     20.086666860000001     14.461542160000000     13.550735899999999\nAu     19.849915020000001     11.500291140000000     13.929575920000000\nAu     18.203707079999997      8.134349860000000     11.415418559999999\nAu     12.103501280000000      5.596092840000000     11.477094980000000\nAu      8.726831360000000      6.989954919999999     11.379983160000000\nAu     13.458248699999999     20.229239160000002     14.136571280000000\nAu      5.824994500000000     11.516631620000000     12.413076260000000\nAu     19.823578319999999      8.953283300000001      8.918741780000000\nAu     16.800891640000000     13.363023699999999      6.938159540000000\nAu     10.601456320000000     22.219121600000001     12.151783540000000\nAu     19.384353040000001     16.051663420000001     11.480358760000000\nAu     19.598360599999999     10.674601860000001     11.369152600000001\nAu     16.288509380000001      7.646101840000000      9.603732059999999\nAu     12.768792660000001      6.346497560000000      8.960019380000000\nAu      8.697416520000001      8.407335300000000      8.965255519999999\nAu      6.797984440000000     10.876497060000000      9.867724620000001\nAu     17.578453880000001     18.347129580000001     11.320692500000000\nAu      6.982779440000001     15.368143180000001     10.044680359999999\nAu     12.164836320000001     20.085681200000000     11.335236380000001\nAu     15.931543160000000     18.646012840000001      8.813956320000001\nAu     18.714248800000000     14.797063059999999      8.824478780000000\nAu     19.259977880000001     11.802296740000001      8.622613480000000\nAu     11.168200160000000      8.446574760000001      7.447677380000000\nAu      7.936001840000000     13.342172739999999      8.033803440000000\nAu      8.404184619999999     17.694616940000000      9.555847079999999\nAu     10.922264080000000     18.172465219999999      8.108186060000000\nAu     16.770255580000001     16.188182919999999      7.378982260000001\nAu     16.482638640000001      9.142010800000000      7.279507820000000\nAu      9.850818900000000     13.567047259999999      6.127539339999999\nAu     11.592718800000000     15.686102120000001      6.183091720000000\nAu     14.511308499999998     14.425972860000002      5.581820140000000\nAu     14.718405000000001     11.867594960000000      5.799696240000000\nAu     13.153171199999999     12.799080839999998     21.511005359999999\nAu     15.866146140000000      5.376712380000000     16.164293080000000\nAu     12.007154640000001     10.765542320000000      6.032723060000000\nAu      6.091819240000000      8.297361540000001     16.326606920000000\nAu     15.017037879999998     20.098270400000001     16.279437460000000\nAu     21.309804359999998     13.894095020000000     16.589768520000000\nAu      9.906057460000000      5.670948920000000      8.644610260000000\nAu      4.981369900000000     13.211238820000000      9.630275980000000\nAu      9.826256440000000     20.086995240000000      9.807254859999999\nAu     18.910402420000000     18.094642539999999      7.923172140000000\nAu      6.814942160000000     16.857007180000000     18.505767800000001\nAu      5.772922740000000     14.424667399999999     12.716445560000000\nAu     12.211542720000001     13.702351000000000      4.072038620000000\nS       9.110522200000000     22.318353720000001     10.422336860000000\nS      14.865696820000002      3.409562000000000     17.083041299999998\nS      12.189367579999999     15.969874959999999      3.849694420000000\nS      14.319914699999998     10.749139960000001     21.962681000000000\nS       9.859341700000000      6.776785860000000      6.482259940000000\nS      15.589818400000000     19.960605340000001     18.660783179999999\nS       5.286265140000000     10.062323440000000     17.510252760000000\nS       8.153317120000001     16.667644499999998     20.438635880000000\nS      20.112492399999997     16.158455300000000      7.410193960000000\nS      21.390520840000001      9.315082400000000     10.699342419999999\nS       3.778480680000000     14.247341159999998     11.301766579999999\nS      20.550006620000001     13.826214480000001     18.762242199999999\nS      22.300191160000001     14.293317740000001     14.563210999999999\nS      17.870727419999998     20.428068439999997     12.620086180000001\nS       8.603768940000000     11.637430739999999      5.426605340000000\nS      17.997446480000001      6.148516400000000     17.088404579999999\nS       7.859505940000001     19.981474240000001     13.743408119999998\nS       6.096033580000000     17.343995499999998      8.924771959999999\nS      17.601266020000001     20.064119659999999      7.733178180000000\nS      18.601381499999999      8.064085380000000      6.978406500000000\nS      10.438453220000000      4.844228740000000     16.819001680000000\nS      10.588233240000001      9.238028799999999     20.598524699999999\nS      11.128319800000000     19.716209240000001     18.714703799999999\nS      16.333594160000001     15.861889160000000      4.937316020000000\nS       3.739451040000000     10.707820240000000     13.194334140000002\nS       8.979876619999999      4.698098340000000     10.461880260000001\nS      13.875745779999999      6.410532440000000      6.895359899999999\nS       6.788104440000000      9.314853859999999      7.900278100000000\nS      18.526850420000002      6.085913860000000     12.599475200000001\nS       5.144759100000000     13.358453940000000     18.363912320000001\nS      19.194665619999999     18.107404379999998     16.917787120000000\nS      11.770779279999999     14.623271259999999     21.547871799999999\nS       7.818926960000001     12.265808359999999     20.361473860000000\nS       6.600626500000001      6.481149740000000     14.933095059999999\nS      12.298442260000000     11.400063220000000      3.791133320000000\nS      15.973794200000000     10.056388940000001      5.031101660000000\nS      22.409626979999999     17.115829900000001     10.053943380000000\nS      18.921962539999999     12.264373939999999      6.299057700000000\nS      12.448396480000000     22.339630300000000     13.519640420000000\nS      12.532392860000000     18.887277500000000      6.573670220000000\nS      12.616995559999999      4.022648500000000     13.078064739999999\nS      21.402471999999999     10.825800440000000     15.596773920000000\nS      15.827786260000002     14.338957359999998     21.739826420000000\nS      13.950394380000001     21.019322740000000     10.048097020000000\nS      13.899679299999999      6.801141880000000     19.480803680000001\nS       5.351096400000000     17.105815999999997     16.759402139999999\nS       5.698638400000000     12.580599979999999      7.491243760000000\nS      20.655509940000002     17.945209360000000     10.886724940000001\nS       5.292376440000000     17.588569440000001     12.735988200000000\nS      15.896883600000001      5.440165120000000     10.263948500000000\nH       7.948080140000000     21.875232860000001     11.082926920000000\nH      15.204347600000002      3.644606680000000     18.457504260000000\nH      13.576636060000000     16.007276220000001      4.190440020000000\nH      15.707326699999999     11.037108420000001     21.877264239999999\nH       8.608490800000000      7.337536700000000      6.612995740000001\nH      14.431670500000001     20.261963020000000     19.387990960000000\nH       8.588834280000000     17.958275139999998     20.158708440000002\nH       4.448457520000000     13.802266139999999     17.214642640000001\nH      21.317487359999998     16.293651659999998      8.069239360000001\nH      22.127289860000001     10.193362400000000      9.940900060000001\nH       3.284183500000000     13.019324240000001     11.787350640000000\nH      20.269198560000000     15.190271459999998     18.757590799999999\nH      22.573764460000000     15.606621940000000     14.802690240000000\nH      17.160093600000000     21.306620660000000     11.855809420000000\nH       9.468175600000000     11.134570719999999      4.462936140000000\nH      17.758382720000000      6.122228320000001     18.418831860000001\nH       6.986179460000001     19.399344379999999     12.789246600000000\nH       6.455809620000000     17.015421539999998      7.659317640000001\nH      18.189929159999998     20.690723819999999      8.867208220000000\nH      18.336398340000002      6.839400100000000      7.598033560000000\nH      10.130531320000001      5.150386280000000     18.126999020000000\nH      11.762061480000000      8.520661239999999     20.636494840000001\nH      10.486681140000000     20.667107500000000     17.903168140000002\nH      17.170023260000001     14.795000999999999      4.574025300000000\nH       4.043383500000000      9.415093479999999     12.898969980000000\nH      10.085872419999999      4.551892019999999     11.267985040000001\nH      12.762657700000000      6.487022620000000      6.039873320000000\nH       5.858152820000000      8.437403000000000      8.400688400000000\nH      19.587245339999999      6.531534620000000     13.428118860000000\nH       4.833012600000000     12.062878099999999     18.059472860000000\nH      19.093432799999999     17.830985120000001     18.293802539999998\nH      11.500198060000001     15.036945820000000     22.863939540000001\nH       7.107433060000000     13.305734519999998     19.900653500000001\nH       5.582217160000000      6.567726360000000     14.044544799999999\nH      13.667559619999999     11.042651100000000      3.888368120000000\nH      14.996889180000000      9.187786140000000      4.658672980000000\nH      22.884269720000002     18.210292360000000      9.322399840000001\nH      19.671391220000000     13.431530320000000      6.316714040000000\nH      11.731205200000000     22.684781080000000     14.626330420000000\nH      12.087900240000000     18.335499779999999      5.333280680000000\nH      13.827246940000002      3.587206220000000     12.618319999999999\nH      21.895966300000001     11.988139800000001     16.158261860000000\nH      17.011020259999999     15.113367619999998     21.683599600000001\nH      14.213526860000000     22.205040520000001     10.767471000000000\nH      14.263668120000002      5.479919120000000     19.097325000000001\nH       4.313850840000000     16.385467020000000     17.326069280000002\nH       5.248608560000000     13.757932499999999      6.843214559999999\nH      19.875038820000000     18.017433199999999      9.682071100000000\nH       5.079612460000000     17.343160900000001     11.365946800000000\nH      14.786332600000000      5.289413479999999      9.345354720000000\n", settings: {shadows: 0.6}},
    {label: "Caffeine", preset: "toon", data: "24\nCaffeine\nH      -3.3804130    -1.1272367     0.5733036\nN       0.9668296    -1.0737425    -0.8198227\nC       0.0567293     0.8527195     0.3923156\nN      -1.3751742    -1.0212243    -0.0570552\nC      -1.2615018     0.2590713     0.5234135\nC      -0.3068337    -1.6836331    -0.7169344\nC       1.1394235     0.1874122    -0.2700900\nN       0.5602627     2.0839095     0.8251589\nO      -0.4926797    -2.8180554    -1.2094732\nC      -2.6328073    -1.7303959    -0.0060953\nO      -2.2301338     0.7988624     1.0899730\nH       2.5496990     2.9734977     0.6229590\nC       2.0527432    -1.7360887    -1.4931279\nH      -2.4807715    -2.7269528     0.4882631\nH      -3.0089039    -1.9025254    -1.0498023\nH       2.9176101    -1.8481516    -0.7857866\nH       2.3787863    -1.1211917    -2.3743655\nH       1.7189877    -2.7489920    -1.8439205\nC      -0.1518450     3.0970046     1.5348347\nC       1.8934096     2.1181245     0.4193193\nN       2.2861252     0.9968439    -0.2440298\nH      -0.1687028     4.0436553     0.9301094\nH       0.3535322     3.2979060     2.5177747\nH      -1.2074498     2.7537592     1.7203047\n", settings: {}}
  ];

  var RCSB = "https://files.rcsb.org/download/";
  var SCENES = {};
  // Defaults that depend on the structure (proteins open as cartoons,
  // AlphaFold models colored by confidence), for "Reset all settings".
  var baseSettings = {cartoon: false};
  // Where the shown structure came from, for "Copy as Python".
  var current = {kind: "text", name: "structure"};

  // --- viewer state (the "host" of SpeckViewer) ------------------------------
  function freshState() {
    var s = {data: "", toolbar: true, camera: {}};
    for (var k in S.VIEW_DEFAULTS) s[k] = JSON.parse(JSON.stringify(S.VIEW_DEFAULTS[k]));
    return s;
  }
  var state = freshState();
  var stage = document.querySelector(".stage");
  var controls = [].slice.call(document.querySelectorAll("[data-trait]"));

  var viewer = new S.SpeckViewer(document.getElementById("viewer"), {
    get: function (trait) { return state[trait]; },
    set: function (changes) { apply(changes); },   // toolbar buttons
    cameraChanged: function (camera) { state.camera = camera; },
    framesChanged: function (n) { setFrameCount(n); }
  });
  window.speckViewer = viewer;   // for scripting the demo from the console

  function apply(changes) {
    for (var k in changes) {
      state[k] = changes[k];
      if (k in S.VIEW_DEFAULTS) viewer.setTrait(k, changes[k]);
    }
    syncControls();
    markPreset(viewer.currentLook() || null);   // also when picked in the toolbar
  }

  function toHex(v) {
    if (Array.isArray(v)) {
      return "#" + v.map(function (c) { return ("0" + Math.round(Math.max(0, Math.min(1, c)) * 255).toString(16)).slice(-2); }).join("");
    }
    return /^#[0-9a-f]{6}$/i.test(v || "") ? v : "#ffffff";
  }

  function syncControls() {
    controls.forEach(function (el) {
      var v = state[el.dataset.trait];
      if (el.type === "checkbox") el.checked = !!v;
      else if (el.type === "color") el.value = toHex(v);
      else el.value = v;
      var out = el.parentNode.querySelector(".v");
      if (out) out.textContent = Number(v).toFixed(el.dataset.digits === undefined ? 2 : +el.dataset.digits);
    });
    document.getElementById("focusLigands").checked = !!(state.dofFocus && state.dofFocus.ligands);
    syncHighlight();
    syncElementColors();
  }

  controls.forEach(function (el) {
    el.addEventListener(el.type === "range" || el.type === "color" ? "input" : "change", function () {
      var change = {};
      change[el.dataset.trait] = el.type === "checkbox" ? el.checked :
                                 el.type === "range" || el.dataset.type === "number" ? parseFloat(el.value) : el.value;
      apply(change);
    });
  });
  document.getElementById("focusLigands").addEventListener("change", function (e) {
    apply({dofFocus: e.target.checked ? {ligands: true} : {},
           dofStrength: e.target.checked && state.dofStrength === 0 ? 1.0 : state.dofStrength});
  });

  // --- frames (trajectories) ------------------------------------------------
  var frameRow = document.getElementById("frameRow");
  var frameCount = 1;
  function setFrameCount(n) {
    frameCount = n;
    frameRow.querySelector("input").max = Math.max(0, n - 1);
    frameRow.style.display = n > 1 ? "" : "none";
  }
  setFrameCount(1);

  // --- highlight -------------------------------------------------------------
  var hl = {chain: document.getElementById("hlChain"), resName: document.getElementById("hlResName"),
            resSeq: document.getElementById("hlResSeq"), ligands: document.getElementById("hlLigands"),
            recolor: document.getElementById("hlRecolor"), color: document.getElementById("hlColor")};
  function list(text) {
    return text.split(/[,\s]+/).filter(function (x) { return x; });
  }
  function readHighlight() {
    var sel = {};
    if (list(hl.chain.value).length) sel.chain = list(hl.chain.value);
    if (list(hl.resName.value).length) sel.resName = list(hl.resName.value.toUpperCase());
    if (list(hl.resSeq.value).length) sel.resSeq = list(hl.resSeq.value);
    if (hl.ligands.checked) sel.ligands = true;
    apply({highlight: sel, highlightColor: hl.recolor.checked ? hl.color.value : ""});
  }
  function syncHighlight() {
    var sel = state.highlight || {};
    var text = function (v) { return v === undefined ? "" : [].concat(v).join(", "); };
    if (document.activeElement !== hl.chain) hl.chain.value = text(sel.chain);
    if (document.activeElement !== hl.resName) hl.resName.value = text(sel.resName);
    if (document.activeElement !== hl.resSeq) hl.resSeq.value = text(sel.resSeq);
    hl.ligands.checked = !!sel.ligands;
    hl.recolor.checked = !!state.highlightColor;
    if (state.highlightColor) hl.color.value = state.highlightColor;
  }
  [hl.chain, hl.resName, hl.resSeq].forEach(function (el) { el.addEventListener("change", readHighlight); });
  [hl.ligands, hl.recolor].forEach(function (el) { el.addEventListener("change", readHighlight); });
  hl.color.addEventListener("input", function () { if (hl.recolor.checked) readHighlight(); });

  // --- element colors ----------------------------------------------------------
  var elList = document.getElementById("elList");
  document.getElementById("elSet").addEventListener("click", function () {
    var sym = document.getElementById("elSymbol").value.trim();
    sym = sym.charAt(0).toUpperCase() + sym.slice(1).toLowerCase();
    if (!(sym in S.elements)) { elList.textContent = "Unknown element " + JSON.stringify(sym); return; }
    var colors = Object.assign({}, state.atomColors || {});
    colors[sym] = document.getElementById("elColor").value;
    apply({atomColors: colors});
  });
  function syncElementColors() {
    var colors = state.atomColors || {};
    var keys = Object.keys(colors);
    elList.innerHTML = "";
    if (!keys.length) return;
    elList.appendChild(document.createTextNode("Custom: " + keys.map(function (k) { return k + " " + toHex(colors[k]); }).join(", ") + " · "));
    var reset = document.createElement("a");
    reset.textContent = "reset";
    reset.addEventListener("click", function () { apply({atomColors: {}}); });
    elList.appendChild(reset);
  }

  // --- background ----------------------------------------------------------------
  // The viewer is transparent; the page paints a radial gradient behind it (the
  // gallery images use the same ones) and exports composite it under the image.
  var BACKGROUNDS = [
    {name: "Page", center: null},
    {name: "Studio light", center: [252, 252, 253], edge: [221, 226, 234]},
    {name: "Dark", center: [24, 30, 46], edge: [8, 10, 16]},
    {name: "Warm", center: [250, 246, 240], edge: [214, 206, 196]},
    {name: "Mint", center: [246, 251, 248], edge: [206, 222, 214]},
    {name: "White", center: [255, 255, 255], edge: [255, 255, 255]},
    {name: "Black", center: [0, 0, 0], edge: [0, 0, 0]}
  ];
  var background = {center: null, edge: null, vignette: false, fromScene: false};
  var vignetteEl = document.createElement("div");
  vignetteEl.className = "vignette";
  document.querySelector("#viewer canvas").insertAdjacentElement("afterend", vignetteEl);
  var bgCenter = document.getElementById("bgCenter"), bgEdge = document.getElementById("bgEdge"),
      bgVignette = document.getElementById("bgVignette"), bgSwatches = document.getElementById("bgSwatches");
  function rgbHex(c) { return toHex(c.map(function (x) { return x / 255; })); }
  function hexRgb(h) { var v = parseInt(h.slice(1), 16); return [v >> 16 & 255, v >> 8 & 255, v & 255]; }
  function css(c) { return "rgb(" + c.join(",") + ")"; }
  function setBackground(bg) {
    background = Object.assign({}, background, bg);
    var b = background;
    stage.style.background = b.center ? "radial-gradient(ellipse at 50% 42%, " + css(b.center) + " 0%, " + css(b.edge) + " 100%)" : "";
    // The vignette darkens the molecule too (as in the gallery), so it lies over the canvas.
    vignetteEl.style.display = b.center && b.vignette ? "" : "none";
    // Light hint text on dark backgrounds.
    var lum = b.center ? 0.3 * b.center[0] + 0.59 * b.center[1] + 0.11 * b.center[2] : 255;
    stage.classList.toggle("dark", lum < 110);
    bgCenter.value = rgbHex(b.center || [245, 246, 248]);
    bgEdge.value = rgbHex(b.edge || [245, 246, 248]);
    bgVignette.checked = !!b.vignette;
    [].forEach.call(bgSwatches.children, function (btn, k) {
      var p = BACKGROUNDS[k];
      btn.classList.toggle("active", p.center ? !!b.center && p.center.join() === b.center.join() && p.edge.join() === b.edge.join() : !b.center);
    });
  }
  BACKGROUNDS.forEach(function (p) {
    var btn = document.createElement("button");
    btn.title = btn.ariaLabel = p.name;
    btn.setAttribute("aria-label", p.name);
    btn.style.background = p.center ? "radial-gradient(circle at 50% 40%, " + css(p.center) + ", " + css(p.edge) + ")" :
      "linear-gradient(135deg, #f5f6f8 45%, #d7dbe2 45%, #d7dbe2 55%, #f5f6f8 55%)";
    btn.addEventListener("click", function () { setBackground({center: p.center, edge: p.edge, fromScene: false}); });
    bgSwatches.appendChild(btn);
  });
  bgCenter.addEventListener("input", function () {
    setBackground({center: hexRgb(bgCenter.value), edge: background.edge || hexRgb(bgEdge.value), fromScene: false});
  });
  bgEdge.addEventListener("input", function () {
    setBackground({center: background.center || hexRgb(bgCenter.value), edge: hexRgb(bgEdge.value), fromScene: false});
  });
  bgVignette.addEventListener("change", function () {
    setBackground({vignette: bgVignette.checked, center: background.center || [252, 252, 253], edge: background.edge || [221, 226, 234]});
  });

  setBackground({});

  // --- reset -------------------------------------------------------------------------
  function defaults(traits) {
    var out = {};
    traits.forEach(function (k) {
      out[k] = JSON.parse(JSON.stringify(k in baseSettings ? baseSettings[k] : S.VIEW_DEFAULTS[k]));
    });
    return out;
  }
  // Settings shown in a section, plus those its custom controls set.
  var EXTRA = {colors: ["atomColors"], highlight: ["highlight", "highlightColor"], dof: ["dofFocus"]};
  function sectionTraits(sec) {
    var traits = [].map.call(sec.querySelectorAll("[data-trait]"), function (el) { return el.dataset.trait; });
    return traits.concat(EXTRA[sec.dataset.sec] || []).filter(function (k) { return k in S.VIEW_DEFAULTS && k !== "frame"; });
  }
  [].forEach.call(document.querySelectorAll("details.sec"), function (sec) {
    var traits = sectionTraits(sec);
    var isBackground = sec.dataset.sec === "background";
    if (!traits.length && !isBackground) return;
    var button = document.createElement("button");
    button.className = "reset-sec";
    var title = sec.querySelector("summary").childNodes[0].textContent.trim();
    button.textContent = "Reset " + title.toLowerCase();
    button.addEventListener("click", function () {
      if (isBackground) setBackground({center: null, edge: null, vignette: false, fromScene: false});
      else apply(defaults(traits));
    });
    sec.querySelector(".sec-body").appendChild(button);
  });
  document.getElementById("resetAll").addEventListener("click", function () {
    apply(defaults(Object.keys(S.VIEW_DEFAULTS).filter(function (k) { return k !== "frame"; })));
    setBackground({center: null, edge: null, vignette: false, fromScene: false});
    markPreset(viewer.currentLook() || null);
  });

  // --- remembered sections ---------------------------------------------------------
  [].forEach.call(document.querySelectorAll("details.sec"), function (d) {
    var key = "speck.section." + d.dataset.sec;
    try {
      var saved = localStorage.getItem(key);
      if (saved !== null) d.open = saved === "1";
    } catch (e) { /* storage unavailable */ }
    d.addEventListener("toggle", function () {
      try { localStorage.setItem(key, d.open ? "1" : "0"); } catch (e) { /* ignore */ }
    });
  });

  // --- presets ------------------------------------------------------------
  var presetBox = document.getElementById("presets");
  Object.keys(PRESETS).forEach(function (name) {
    var b = document.createElement("button");
    b.textContent = name;
    b.dataset.preset = name;
    b.addEventListener("click", function () {
      var values = Object.assign({}, PRESETS["default"], PRESETS[name]);
      apply(values);
      markPreset(name);
    });
    presetBox.appendChild(b);
  });
  function markPreset(name) {
    [].forEach.call(presetBox.children, function (b) { b.classList.toggle("active", b.dataset.preset === name); });
  }

  // --- loading ------------------------------------------------------------
  var info = document.getElementById("info");
  // Only the most recently started load is shown (a slow download must not
  // replace a structure picked after it).
  var loadTicket = 0;

  // Downloads text, reporting progress in the viewer's loading panel.
  function fetchText(url, label) {
    label = label || "Downloading " + url.split("/").pop();
    viewer.progress("download", label, 0);
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(r.status + " for " + url);
      // Content-Length is the compressed size when the server gzips the
      // transfer, so it only gives a fraction while it is not exceeded.
      var total = parseInt(r.headers.get("content-length") || "0");
      if (!r.body || !r.body.getReader) {
        return r.text().then(function (t) { viewer.progressDone("download", mb(t.length)); return t; });
      }
      var reader = r.body.getReader(), chunks = [], got = 0;
      function pump() {
        return reader.read().then(function (part) {
          if (part.done) {
            viewer.progressDone("download", mb(got));
            return new Blob(chunks).text();
          }
          chunks.push(part.value);
          got += part.value.length;
          viewer.progress("download", label, total && got <= total ? got / total : null, mb(got) + " received");
          return pump();
        });
      }
      return pump();
    });
  }

  function mb(n) {
    return n >= 1e6 ? (n / 1e6).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1e3)) + " kB";
  }

  function fetchStructure(query) {
    query = query.trim();
    // "1UBQ", or "1STM-assembly1" for a biological assembly (e.g. a whole capsid)
    var entry = /^([0-9][A-Za-z0-9]{3})(?:[-\s]*assembly\s*(\d+))?$/i.exec(query);
    if (entry) {
      var id = entry[1].toUpperCase();
      var file = entry[2] ? id + "-assembly" + entry[2] : id;
      // mmCIF: available for every entry, including those too large for PDB files
      return fetchText("https://files.rcsb.org/download/" + file + ".cif", "Downloading " + file + " from RCSB")
        .then(function (t) { return {text: t, source: "RCSB " + file}; });
    }
    viewer.progress("lookup", "Looking up " + query.toUpperCase() + " in AlphaFold DB");
    return fetch("https://alphafold.ebi.ac.uk/api/prediction/" + encodeURIComponent(query.toUpperCase()))
      .then(function (r) { if (!r.ok) throw new Error("no AlphaFold model for " + query); return r.json(); })
      .then(function (entries) {
        viewer.progressDone("lookup", entries[0].entryId || "");
        return fetchText(entries[0].pdbUrl, "Downloading the AlphaFold model");
      })
      .then(function (t) { return {text: t, source: "AlphaFold " + query.toUpperCase()}; });
  }

  // A new structure: a gallery scene's background does not carry over (one the
  // user picked does).
  function resetScene() {
    if (background.fromScene) setBackground({center: null, edge: null, vignette: false, fromScene: false});
  }

  function show(text, source, preset, settings) {
    resetScene();
    var next = freshState();
    Object.assign(next, PRESETS["default"], PRESETS[preset || "default"], settings || {});
    next.data = text;
    state = next;
    for (var k in S.VIEW_DEFAULTS) viewer.setTrait(k, state[k]);
    viewer.updateToolbar();
    syncControls();
    markPreset(preset || null);
    info.textContent = source + " · reading…";
    return viewer.loadStructure().then(function () {
      if (state === next) info.textContent = source + " · " + viewer.atomCount.toLocaleString() + " atoms";
    });
  }

  function load(sample, button) {
    [].forEach.call(document.querySelectorAll("#samples button"), function (b) { b.classList.toggle("active", b === button); });
    if (sample.query) history.replaceState(null, "", "?q=" + encodeURIComponent(sample.query.trim()));
    var ticket = ++loadTicket;
    current = sample.data ? {kind: "text", name: sample.label} : {kind: "query", query: sample.query.trim()};
    var ready = sample.data ? Promise.resolve({text: sample.data, source: sample.label}) : fetchStructure(sample.query);
    return ready.then(function (r) {
      if (ticket !== loadTicket) return;
      var isPDB = /^(pdb|mmcif)$/.test(S.detectFormat(r.text));
      var settings = Object.assign({}, sample.settings || {});
      if (isPDB && !("cartoon" in settings) && !("surface" in settings)) settings.cartoon = true;
      if (/^AlphaFold/.test(r.source) && !settings.cartoonColor) settings.cartoonColor = "plddt";
      baseSettings = {cartoon: !!settings.cartoon, cartoonColor: settings.cartoonColor || S.VIEW_DEFAULTS.cartoonColor};
      return show(r.text, r.source, sample.preset, settings);
    }).catch(function (e) {
      if (ticket !== loadTicket) return;
      info.textContent = "Could not load: " + e.message;
      viewer.progressFailed("Could not load: " + e.message);
    });
  }

  var samplesBox = document.getElementById("samples");
  SAMPLES.forEach(function (s, i) {
    var b = document.createElement("button");
    b.textContent = s.label;
    b.addEventListener("click", function () { load(s, b); });
    samplesBox.appendChild(b);
    if (i === 0) s.button = b;
  });

  var query = document.getElementById("query");
  function loadQuery() { if (query.value.trim()) load({query: query.value, preset: "glossy"}, null); }
  document.getElementById("go").addEventListener("click", loadQuery);
  query.addEventListener("keydown", function (e) { if (e.key === "Enter") loadQuery(); });

  // Drop a PDB, mmCIF, SDF / MOL or XYZ file on the viewer (.gz too).
  function fileText(f) {
    if (!/\.gz$/i.test(f.name) || !window.DecompressionStream) return f.text();
    return new Response(f.stream().pipeThrough(new DecompressionStream("gzip"))).text();
  }
  stage.addEventListener("dragover", function (e) { e.preventDefault(); });
  stage.addEventListener("drop", function (e) {
    e.preventDefault();
    var f = e.dataTransfer.files[0];
    if (!f) return;
    var ticket = ++loadTicket;
    current = {kind: "file", name: f.name};
    fileText(f).then(function (t) {
      if (ticket !== loadTicket) return;
      var isPDB = /^(pdb|mmcif)$/.test(S.detectFormat(t));
      baseSettings = {cartoon: isPDB, cartoonColor: S.VIEW_DEFAULTS.cartoonColor};
      show(t, f.name, "glossy", isPDB ? {cartoon: true} : {});
    });
  });

  // --- export -------------------------------------------------------------
  // Saves the image on the chosen background (the same gradient and vignette as
  // on the page), or transparent.
  function paintBackground(ctx, w, h) {
    var b = background;
    var center = b.center || [255, 255, 255], edge = b.edge || center;
    // An ellipse like CSS "ellipse at 50% 42%" (farthest corner).
    var cx = w / 2, cy = 0.42 * h, rx = Math.max(cx, w - cx) * Math.SQRT2, ry = Math.max(cy, h - cy) * Math.SQRT2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    var g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, css(center));
    g.addColorStop(1, css(edge));
    ctx.fillStyle = g;
    ctx.fillRect(-cx, -cy * rx / ry, w, h * rx / ry);
    ctx.restore();
  }

  function paintVignette(ctx, w, h) {
    var b = background, cx = w / 2;
    if (b.center && b.vignette) {
      var cy2 = 0.45 * h, rx2 = Math.max(cx, w - cx) * Math.SQRT2, ry2 = Math.max(cy2, h - cy2) * Math.SQRT2;
      ctx.save();
      ctx.translate(cx, cy2);
      ctx.scale(1, ry2 / rx2);
      var v = ctx.createRadialGradient(0, 0, 0, 0, 0, rx2);
      v.addColorStop(0.55, "rgba(0,0,0,0)");
      v.addColorStop(1, "rgba(0,0,0,0.22)");
      ctx.fillStyle = v;
      ctx.fillRect(-cx, -cy2 * rx2 / ry2, w, h * rx2 / ry2);
      ctx.restore();
    }
  }

  document.getElementById("export").addEventListener("click", function () {
    var width = parseInt(document.getElementById("exportSize").value);
    var transparent = document.getElementById("exportTransparent").checked;
    var button = this;
    button.disabled = true;
    viewer.renderImage({width: width, transparent: true}).then(function (image) {
      if (transparent) return image.png;
      return new Promise(function (resolve) {
        var img = new Image(), url = URL.createObjectURL(new Blob([image.png], {type: "image/png"}));
        img.onload = function () {
          var c = document.createElement("canvas");
          c.width = image.width; c.height = image.height;
          var ctx = c.getContext("2d");
          paintBackground(ctx, c.width, c.height);
          ctx.drawImage(img, 0, 0);
          paintVignette(ctx, c.width, c.height);
          URL.revokeObjectURL(url);
          c.toBlob(function (b) { b.arrayBuffer().then(resolve); }, "image/png");
        };
        img.src = url;
      });
    }).then(function (png) {
      var url = URL.createObjectURL(new Blob([png], {type: "image/png"}));
      var a = document.createElement("a");
      a.href = url;
      a.download = "ipyspeck.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }).catch(function (e) { info.textContent = "Export failed: " + e.message; })
      .then(function () { button.disabled = false; });
  });

  // --- animate ----------------------------------------------------------------
  // A few ready-made films (see core/src/film.js for the shots), previewed in
  // the viewer or rendered to an MP4 in the browser.
  var film = {
    kind: document.getElementById("filmKind"), seconds: document.getElementById("filmSeconds"),
    secondsV: document.getElementById("filmSecondsV"), title: document.getElementById("filmTitle"),
    size: document.getElementById("filmSize"), fps: document.getElementById("filmFps"),
    samples: document.getElementById("filmSamples"), note: document.getElementById("filmNote"),
    preview: document.getElementById("filmPreview"), save: document.getElementById("filmSave")
  };
  var lastFilm = null;
  film.seconds.addEventListener("input", function () { film.secondsV.textContent = film.seconds.value; });
  if (!S.videoSupported()) {
    film.save.disabled = true;
    film.note.textContent = "Saving video needs Chrome, Edge, Safari 16.4+ or Firefox 130+; preview works here.";
  }

  function buildFilm() {
    var t = parseFloat(film.seconds.value), kind = film.kind.value;
    var ligand = viewer.ligands()[0];
    var sel = ligand ? ligand.selection : null;
    var needLigand = function () {
      if (!sel) throw new Error("this structure has no ligand to fly to");
    };
    var shots;
    if (kind === "turntable") shots = [{type: "turntable", seconds: t}];
    else if (kind === "rock") shots = [{type: "rock", seconds: t, degrees: 25}];
    else if (kind === "orbit") shots = [{type: "orbit", seconds: t, degrees: 360, tilt: 25}];
    else if (kind === "tour") {
      needLigand();
      shots = [{type: "orbit", seconds: 0.3 * t, degrees: 60}, {type: "fly_to", selection: sel, seconds: 0.25 * t},
               {type: "rock", seconds: 0.2 * t, degrees: 15}, {type: "home", seconds: 0.25 * t}];
    } else if (kind === "focus") {
      needLigand();
      shots = [{type: "together", shots: [{type: "rock", seconds: t, degrees: 12},
                                          {type: "rack_focus", to: sel, seconds: 0.5 * t}]}];
    } else if (kind === "cut") {
      shots = [{type: "together", shots: [{type: "orbit", seconds: t, degrees: 120, tilt: 15},
                                          {type: "cut_open", seconds: 0.4 * t, to: 0.5}]}];
    } else {
      if (frameCount < 2) throw new Error("this structure has no trajectory (one frame)");
      shots = [{type: "trajectory", seconds: t}];
    }
    var title = film.title.value.trim();
    if (title) {
      var first = shots[0];
      var span = Math.min(3, first.seconds || t);
      shots[0] = {type: "together", shots: [first, {type: "title", text: title, seconds: span}]};
    }
    return shots;
  }

  function filmOptions() {
    var b = background;
    return {
      size: film.size.value, fps: parseInt(film.fps.value), samples: parseInt(film.samples.value),
      background: b.center ? {center: rgbHex(b.center), edge: rgbHex(b.edge || b.center)} : "#ffffff",
      vignette: b.center && b.vignette ? 0.22 : 0, filename: "ipyspeck.mp4"
    };
  }

  function filmAction(run) {
    try {
      lastFilm = {shots: buildFilm(), options: filmOptions()};
      return run(lastFilm);
    } catch (e) {
      film.note.textContent = e.message;
    }
  }
  film.preview.addEventListener("click", function () {
    filmAction(function (f) { viewer.playFilm(f.shots, f.options); });
  });
  film.save.addEventListener("click", function () {
    filmAction(function (f) {
      film.save.disabled = true;
      var started = performance.now();
      return viewer.downloadFilm(f.shots, f.options).then(function (r) {
        film.note.textContent = "Saved " + r.frames + " frames at " + r.width + " × " + r.height + " (" +
          (r.mp4.length / 1e6).toFixed(1) + " MB) in " + Math.round((performance.now() - started) / 1000) + " s.";
      }, function (e) {
        film.note.textContent = e.message === "cancelled" ? "Cancelled." : "Video export failed: " + e.message;
      }).then(function () { film.save.disabled = false; });
    });
  });

  // A film as ipyspeck.shots calls.
  var SHOT_ARGS = {fly_to: "selection", rack_focus: "to", title: "text"};
  function pyShot(shot) {
    var args = [], rest = Object.assign({}, shot);
    delete rest.type;
    if (shot.type === "together") {
      return "shots.together(" + shot.shots.map(pyShot).join(", ") + ")";
    }
    var first = SHOT_ARGS[shot.type];
    if (first) {
      args.push(pyValue(rest[first]));
      delete rest[first];
    }
    if (rest.settings) {
      Object.keys(rest.settings).forEach(function (k) { args.push(k + "=" + pyValue(rest.settings[k])); });
      delete rest.settings;
    }
    Object.keys(rest).forEach(function (k) {
      args.push((k === "from" ? "start" : k) + "=" + pyValue(k === "seconds" ? Math.round(rest[k] * 100) / 100 : rest[k]));
    });
    return "shots." + shot.type + "(" + args.join(", ") + ")";
  }

  // --- copy as Python ---------------------------------------------------------
  // The current structure, settings (those that differ from the defaults) and
  // camera as ipyspeck code; stspeck.speck() takes the same keyword arguments.
  function pyValue(v) {
    if (v === true) return "True";
    if (v === false) return "False";
    if (v === null || v === undefined) return "None";
    if (typeof v === "number") return String(Math.round(v * 1e4) / 1e4);
    if (typeof v === "string") return JSON.stringify(v);
    if (Array.isArray(v)) return "[" + v.map(pyValue).join(", ") + "]";
    return "{" + Object.keys(v).map(function (k) { return JSON.stringify(k) + ": " + pyValue(v[k]); }).join(", ") + "}";
  }
  function pythonCode() {
    var lines = ["from ipyspeck import Speck", ""];
    var settings = [];
    Object.keys(S.VIEW_DEFAULTS).forEach(function (k) {
      if (k === "frame" && !state.frame) return;
      if (JSON.stringify(state[k]) !== JSON.stringify(S.VIEW_DEFAULTS[k])) settings.push("    " + k + "=" + pyValue(state[k]) + ",");
    });
    var cam = viewer.cameraState();
    settings.push("    camera=" + pyValue({rotation: cam.rotation.map(function (x) { return Math.round(x * 1e5) / 1e5; }),
                                          translation: cam.translation, zoom: cam.zoom}) + ",");
    var src = current, call;
    var q = src.kind === "query" ? src.query : null;
    var entry = q && /^([0-9][A-Za-z0-9]{3})(?:[-\s]*assembly\s*(\d+))?$/i.exec(q);
    if (entry) {
      call = 'Speck.from_pdb_id("' + entry[1].toUpperCase() + '"' + (entry[2] ? ", assembly=" + entry[2] : "") + ",";
    } else if (q) {
      call = 'Speck.from_alphafold("' + q.toUpperCase() + '",';
    } else if (src.kind === "scene" && src.source.pdb) {
      call = 'Speck.from_pdb_id("' + src.source.pdb + '"' + (src.source.assembly ? ", assembly=" + src.source.assembly : "") + ",";
    } else if (src.kind === "scene" && src.source.alphafold) {
      call = 'Speck.from_alphafold("' + src.source.alphafold + '",';
    } else if (src.kind === "file") {
      call = 'Speck.from_file("' + src.name.replace(/"/g, "") + '",';
    } else {
      call = 'Speck(data=open("' + (src.kind === "scene" ? src.source.file.split("/").pop() : "structure.xyz") + '").read(),';
    }
    lines.push("w = " + call);
    lines = lines.concat(settings);
    lines.push(")");
    if (background.center) {
      lines.push("", "# Background of the page (used by save_image):");
      lines.push('w.save_image("figure.png", width=3000, transparent=False, background="' + rgbHex(background.center) + '")');
    }
    lines.push("w");
    if (lastFilm) {
      var o = lastFilm.options;
      lines.push("", "# The film from Animate (w.preview(film) plays it in the widget):", "from ipyspeck import shots",
                 "film = [" + lastFilm.shots.map(pyShot).join(",\n        ") + "]");
      lines.push('w.save_video("film.mp4", film, size=' + pyValue(o.size) + ", fps=" + o.fps + ", samples=" + o.samples +
                 (typeof o.background === "object" ? ", background=" + pyValue(o.background) : "") +
                 (o.vignette ? ", vignette=" + o.vignette : "") + ")");
    }
    return lines.join("\n");
  }
  document.getElementById("copyPython").addEventListener("click", function () {
    var code = pythonCode(), pre = document.getElementById("pythonCode"), button = this;
    pre.textContent = code;
    pre.hidden = false;
    var done = function (ok) {
      button.textContent = ok ? "Copied" : "Select the code below to copy it";
      setTimeout(function () { button.textContent = "Copy as Python"; }, 1800);
    };
    try {
      navigator.clipboard.writeText(code).then(function () { done(true); }, function () { done(false); });
    } catch (e) { done(false); }
  });

  // --- gallery scenes ------------------------------------------------------
  // A scene's camera was recorded for an image of scene.size; the viewer has
  // another aspect, so fit the image's visible area inside the viewer. (The
  // canvas shows the bottom-left part of a square frame of side max(w, h).)
  function fitCamera(camera, size) {
    var el = document.getElementById("viewer");
    var cw = el.clientWidth, ch = el.clientHeight, iw = size[0], ih = size[1];
    var mi = Math.max(iw, ih), mc = Math.max(cw, ch), wi = 1 / camera.zoom;
    var width = wi * iw / mi, height = wi * ih / mi;
    var cx = camera.translation[0] - wi / 2 + width / 2;
    var cy = camera.translation[1] - wi / 2 + height / 2;
    var wc = Math.max(width * mc / cw, height * mc / ch);
    return {rotation: camera.rotation, zoom: 1 / wc,
            translation: [cx - wc * cw / mc / 2 + wc / 2, cy - wc * ch / mc / 2 + wc / 2]};
  }

  function sceneText(source) {
    if (source.alphafold) return fetchStructure(source.alphafold).then(function (r) { return r.text; });
    if (source.pdb) {
      // mmCIF scenes: entries too large for PDB files, and biological assemblies
      var file = source.assembly ? source.pdb + "-assembly" + source.assembly + ".cif" :
                 source.pdb + (source.format === "cif" ? ".cif" : ".pdb");
      return fetchText(RCSB + file, "Downloading " + file + " from RCSB").then(function (t) {
        if (!source.chains) return t;
        return t.split("\n").filter(function (l) {
          return /^(ATOM  |HETATM)/.test(l) && source.chains.indexOf(l.charAt(21)) >= 0;
        }).join("\n") + "\nEND\n";
      });
    }
    return fetchText(source.file, "Loading " + source.file.split("/").pop());
  }

  function loadScene(name) {
    var sc = SCENES[name];
    if (!sc) return;
    [].forEach.call(document.querySelectorAll("#samples button"), function (b) { b.classList.remove("active"); });
    history.replaceState(null, "", "?example=" + name);
    current = {kind: "scene", name: name, source: sc.source};
    var ticket = ++loadTicket;
    sceneText(sc.source).then(function (text) {
      if (ticket !== loadTicket) return;
      resetScene();
      var next = freshState();
      Object.assign(next, sc.settings);
      baseSettings = {cartoon: !!(sc.source.pdb || sc.source.alphafold), cartoonColor: sc.source.alphafold ? "plddt" : S.VIEW_DEFAULTS.cartoonColor};
      if (Object.keys(sc.colors).length) next.atomColors = sc.colors;
      next.data = text;
      next.camera = fitCamera(sc.camera, sc.size);
      state = next;
      for (var k in S.VIEW_DEFAULTS) viewer.setTrait(k, state[k]);
      viewer.updateToolbar();
      var loaded = viewer.loadStructure();
      setBackground({center: sc.background[0], edge: sc.background[1], vignette: !!sc.vignette, fromScene: true});
      syncControls();
      markPreset(null);
      return loaded.then(function () {
        if (state !== next) return;
        info.textContent = /atoms/.test(sc.caption) ? sc.caption : sc.caption + " · " + viewer.atomCount.toLocaleString() + " atoms";
      });
    }).catch(function (e) {
      if (ticket !== loadTicket) return;
      info.textContent = "Could not load: " + e.message;
      viewer.progressFailed("Could not load: " + e.message);
    });
  }

  var galleryBox = document.getElementById("galleryGroups");
  function buildGallery() {
    var groups = [];
    Object.keys(SCENES).forEach(function (name) {
      var g = SCENES[name].group;
      if (groups.indexOf(g) < 0) groups.push(g);
    });
    groups.forEach(function (g) {
      var h = document.createElement("h3");
      h.textContent = g;
      var grid = document.createElement("div");
      grid.className = "grid";
      Object.keys(SCENES).filter(function (n) { return SCENES[n].group === g; }).forEach(function (name) {
        var fig = document.createElement("figure");
        fig.title = "Load this scene in the viewer";
        var img = document.createElement("img");
        img.loading = "lazy";
        img.src = GALLERY + name + ".jpg";
        img.alt = SCENES[name].caption;
        var cap = document.createElement("figcaption");
        cap.textContent = SCENES[name].caption;
        fig.appendChild(img);
        fig.appendChild(cap);
        fig.addEventListener("click", function () {
          window.scrollTo({top: 0, behavior: "smooth"});
          loadScene(name);
        });
        grid.appendChild(fig);
      });
      galleryBox.appendChild(h);
      galleryBox.appendChild(grid);
    });
  }

  syncControls();
  var params = new URLSearchParams(location.search);
  fetch("scenes.json").then(function (r) { return r.json(); }).then(function (scenes) {
    SCENES = scenes;
    buildGallery();
    if (params.get("example") && SCENES[params.get("example")]) loadScene(params.get("example"));
  });
  if (params.get("q")) { query.value = params.get("q"); loadQuery(); }
  else if (!params.get("example")) load(SAMPLES[0], SAMPLES[0].button);
})();
